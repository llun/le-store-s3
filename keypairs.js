// @flow
const Promise = require('bluebird')

/*::
import type Store from './store.js'

type KeyPairFormat = 'jwk' | 'pem'
type KeyPair = {
  privateKeyJwk?:any,
  privateKeyPem?:any
}
*/
class Keypairs {
  /*::
  store:Store
  */

  constructor(store/*: Store */) {
    this.store = store
  }

  checkAsync(keypath/*:string */, format /*:KeyPairFormat*/) {
    if (!keypath) return null

    const { s3, options } = this.store
    const Bucket = options.S3.bucketName
    return s3.getObjectAsync({
      Bucket,
      Key: keypath
    }).then(body => {
      const content = body.Body.toString()
      return format === 'jwk'
        ? { privateKeyJwk: JSON.parse(content) }
        : { privateKeyPem: content }
    }).catch(error => {
      return null
    })
  }

  setAsync(keypath/*:string*/, keypair/*:KeyPair*/, format/*:KeyPairFormat*/) {
    const key = format === 'jwk'
      ? JSON.stringify(keypair.privateKeyJwk, null, '  ')
      : keypair.privateKeyPem

    const { s3, options } = this.store
    const { bucketName } = options.S3
    return s3.putObjectAsync({
      Bucket: bucketName,
      Key: keypath,
      Body: key
    }).then(() => keypair)
  }
}

module.exports = Keypairs
