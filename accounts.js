// @flow
const Promise = require('bluebird')
const crypto = require('crypto')
const path = require('path')
const os = require('os')

/*::
import type Store from './store'
import type KeyPairs, { KeyPair } from './keypairs'

type AccountKeyPathArgs = {
  accountsDir: string,
  accountId: ?string,
  accountKeyPath?: string,
  email: ?string
}

type AccountIdArgs = {
  email: string,
  accountsDir: string
}

type CheckAccountArgs = AccountIdArgs & {
  accountId: string
}

type ErrorFile = {
  error: any
}

type AccountFile = {
  meta: Object | ErrorFile,
  private_key: Object | ErrorFile,
  regr: Object | ErrorFile,
  accountId: string,
  id: string,
  keypair: KeyPair
}

type SetAccountValue = {
  keypair: KeyPair,
  receipt: any
}

type SetAccountResult = {
  id: string,
  accountId: string,
  email: string,
  keypair: KeyPair,
  receipt: any
}
*/

class Accounts {
  /*::
  store:Store
  keypairs:KeyPairs
  */

  constructor(store/*:Store*/, keypairs/*:KeyPairs*/) {
    this.store = store
    this.keypairs = keypairs
  }

  getAccountKeyPath(
    { accountsDir, accountId, accountKeyPath, email }/*:AccountKeyPathArgs*/)/*:Promise<?string>*/ {
    let head = Promise.resolve(accountId)
    if (email && !accountId) head = this.getAccountIdByEmail({ email, accountsDir })

    return head.then(accountId => {
      if (!accountId) return null
      return accountKeyPath || path.join(accountsDir, accountId, 'private_key.json')
    })
  }

  getAccountIdByEmail(
    { email, accountsDir }/*:AccountIdArgs*/)/*:Promise<?string>*/ {
    const { s3, options } = this.store
    const Bucket = options.S3.bucketName
    return s3.listObjects({ Bucket, Prefix: accountsDir }).promise()
      .then(objects => objects.Contents
        .filter(item => item.Key.endsWith('regr.json'))
        .map(item => item.Key))
      .then(regrs => {
        return Promise.all(regrs.map(item => s3.getObject({ Bucket, Key: item }).promise()))
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

  getAccountIdByPublicKey(keypair/*:KeyPair*/)/*:string*/ {
    return crypto.createHash('md5').update(keypair.publicKeyPem).digest('hex')
  }

  checkAsync({ accountId, email, accountsDir }/*:CheckAccountArgs*/)/*:Promise<AccountFile>*/ {
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
        return s3.getObject({ Bucket, Key: path.join(accountDir, `${key}.json`) }).promise()
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
        // $FlowFixMe
        error.code = 'E_ACCOUNT_CORRUPT'
        // $FlowFixMe
        error.data = files
        return Promise.reject(error)
      }

      files.accountId = accountId
      files.id = accountId
      files.keypair = { privateKeyJwk: files.private_key }

      return files
    })
  }

  setAsync(
    { accountsDir, email }/*:AccountIdArgs*/,
    { keypair, receipt }/*:SetAccountValue*/)/*:Promise<SetAccountResult>*/ {
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
      s3.putObject({
        Bucket,
        Key: path.join(accountDir, 'meta.json'),
        Body: JSON.stringify(accountMeta)
      }).promise(),
      s3.putObject({
        Bucket,
        Key: path.join(accountDir, 'private_key.json'),
        Body: JSON.stringify(keypair.privateKeyJwk)
      }).promise(),
      s3.putObject({
        Bucket,
        Key: path.join(accountDir, 'regr.json'),
        Body: JSON.stringify({ body: receipt })
      }).promise()
    ]).then(() => ({
      id: accountId,
      accountId,
      email,
      keypair,
      receipt
    }))
  }

  checkKeypairAsync(
    { accountId, email, accountKeyPath, accountsDir }/*:AccountKeyPathArgs*/)/*:Promise<?KeyPair>*/ {
    if (!(accountKeyPath || accountsDir)) {
      return Promise.reject(new Error('must provide one of options.accountKeyPath or options.accountsDir'))
    }

    return this.getAccountKeyPath({ accountId, email, accountKeyPath, accountsDir })
      .then(keypath => this.keypairs.checkAsync(keypath, 'jwk'))
  }

  setKeypairAsync(
    { email, accountId, accountsDir }/*:CheckAccountArgs*/,
    keypair/*:KeyPair*/)/*:Promise<KeyPair>*/ {
    if (!accountId) {
      accountId = this.getAccountIdByPublicKey(keypair)
    }

    return this.getAccountKeyPath({ accountsDir, accountId, email })
      .then(keypath => this.keypairs.setAsync(keypath, keypair, 'jwk'))
  }
}

module.exports = Accounts
