const Promise = require('bluebird')
const crypto = require('crypto')
const path = require('path')
const os = require('os')

class Accounts {
  constructor(store, keypairs) {
    this.store = store
    this.keypairs = keypairs
  }

  getAccountKeyPath({ accountsDir, accountId, accountKeyPath, email }) {
    console.log('[accounts.getAccountKeyPath]*')
    let head = Promise.resolve(accountId)
    if (email && !accountId) head = this.getAccountIdByEmail({ email, accountsDir })

    return head.then(accountId => {
      if (!accountId) return null
      return accountKeyPath || path.join(accountsDir, accountId, 'private_key.json')
    })
  }

  getAccountIdByEmail({ email, accountsDir }) {
    console.log('[accounts.getAccountIdByEmail]*')
    const { s3, options } = this.store
    const Bucket = options.S3.bucketName
    return s3.listObjectsAsync({ Bucket, Prefix: accountsDir })
      .then(objects => objects.Contents
        .filter(item => item.Key.endsWith('regr.json'))
        .map(item => item.Key))
      .then(regrs => {
        return Promise.all(regrs.map(item => s3.getObjectAsync({ Bucket, Key: item })))
          .then(contents => {
            return contents.map((item, index) => {
              const parts = regrs[index].split('/')
              const json = JSON.parse(item.Body.toString('utf8'))
              json.accountId = parts[parts.length - 2]
              return json
            })
          })
      })
      .then(jsons => {
        const contact = jsons
          .find(json => json.body.contact
            .find(contact => contact.toLowerCase().endsWith(email.toLowerCase())))
        if (contact) return contact.accountId
        return null
      })
  }

  getAccountIdByPublicKey(keypair) {
    console.log('[accounts.getAccountIdByPublicKey]*')
    return crypto.createHash('md5').update(keypair.publicKeyPem).digest('hex')
  }

  checkAsync({ accountId, email, accountsDir }) {
    console.log('[accounts.checkAsync]')
    if (!(accountId || email)) return Promise.reject(new Error('must provide accountId or email'))

    let head = Promise.resolve(accountId)
    if (email) {
      head = this.getAccountIdByEmail({ email, accountsDir })
    }

    return head.then(accountId => {
      if (!accountId) return false
    })
  }

  setAsync({ accountsDir, email }, { keypair, receipt }) {
    console.log('[accounts.setAsync]*')
    const accountId = this.getAccountIdByPublicKey(keypair)
    const accountDir = path.join(accountsDir, accountId)
    const accountMeta = {
      creation_host: os.hostname(),
      creation_dt: new Date().toISOString()
    }

    const { s3, options } = this.store
    const { bucketName } = options.S3
    const Bucket = bucketName

    return Promise.all([
      s3.putObjectAsync({
        Bucket,
        Key: path.join(accountDir, 'meta.json'),
        Body: JSON.stringify(accountMeta)
      }),
      s3.putObjectAsync({
        Bucket,
        Key: path.join(accountDir, 'private_key.json'),
        Body: JSON.stringify(keypair.privateKeyJwk)
      }),
      s3.putObjectAsync({
        Bucket,
        Key: path.join(accountDir, 'regr.json'),
        Body: JSON.stringify({ body: receipt })
      })
    ]).then(() => ({
      id: accountId,
      accountId,
      email,
      keypair,
      receipt
    }))
  }

  checkKeypairAsync({ accountId, email, accountKeyPath, accountsDir }) {
    console.log('[accounts.checkKeypairAsync]*')
    if (!(accountKeyPath || accountsDir)) {
      return Promise.reject(new Error('must provide one of options.accountKeyPath or options.accountsDir'))
    }

    return this.getAccountKeyPath({ accountId, email, accountKeyPath, accountsDir })
      .then(keypath => this.keypairs.checkAsync(keypath, 'jwk'))
  }

  setKeypairAsync({ email, accountId, accountsDir }, keypair) {
    console.log('[accounts.setKeypairAsync]*')
    if (!accountId) {
      accountId = this.getAccountIdByPublicKey(keypair)
    }

    return this.getAccountKeyPath({ accountsDir, accountId, email })
      .then(keypath => this.keypairs.setAsync(keypath, keypair, 'jwk'))
  }
}

module.exports = Accounts
