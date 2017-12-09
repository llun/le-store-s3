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
    let head = Promise.resolve(accountId)
    if (email && !accountId) head = this.getAccountIdByEmail({ email, accountsDir })

    return head.then(accountId => {
      if (!accountId) return null
      return accountKeyPath || path.join(accountsDir, accountId, 'private_key.json')
    })
  }

  getAccountIdByEmail({ email, accountsDir }) {
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
    return crypto.createHash('md5').update(keypair.publicKeyPem).digest('hex')
  }

  checkAsync({ accountId, email, accountsDir }) {
    if (!(accountId || email)) return Promise.reject(new Error('must provide accountId or email'))

    let head = Promise.resolve(accountId)
    if (email) {
      head = this.getAccountIdByEmail({ email, accountsDir })
    }

    const files = {}
    const { s3, options } = this.store
    const Bucket = options.S3.bucketName
    return head.then(accountId => {
      if (!accountId) return false
      const accountDir = path.join(accountsDir, accountId)
      const keys = ['meta', 'private_key', 'regr']
      return Promise.all(keys.map(key => {
        return s3.getObjectAsync({ Bucket, Key: path.join(accountDir, `${key}.json`) })
          .then(item => {
            const body = item.Body.toString('utf8')
            try {
              files[key] = JSON.parse(body)
            } catch (error) {
              files[key] = { error }
            }
            return true
          })
          .catch(error => { files[key] = { error }})
      }))
    }).then(hasAccount => {
      if (!hasAccount) return null

      if (!Object.keys(files).every(key => !files[key].error) ||
        !files.private_key || !files.private_key.n) {
        const error = new Error(`Account ${accountId} was corrupt (had id, but was missing files).`)
        error.code = 'E_ACCOUNT_CORRUPT'
        error.data = files
        return Promise.reject(error)
      }

      files.accountId = accountId
      files.id = accountId
      files.keypair = { privateKeyJwk: files.private_key }

      return files
    })
  }

  setAsync({ accountsDir, email }, { keypair, receipt }) {
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
    if (!(accountKeyPath || accountsDir)) {
      return Promise.reject(new Error('must provide one of options.accountKeyPath or options.accountsDir'))
    }

    return this.getAccountKeyPath({ accountId, email, accountKeyPath, accountsDir })
      .then(keypath => this.keypairs.checkAsync(keypath, 'jwk'))
  }

  setKeypairAsync({ email, accountId, accountsDir }, keypair) {
    if (!accountId) {
      accountId = this.getAccountIdByPublicKey(keypair)
    }

    return this.getAccountKeyPath({ accountsDir, accountId, email })
      .then(keypath => this.keypairs.setAsync(keypath, keypair, 'jwk'))
  }
}

module.exports = Accounts
