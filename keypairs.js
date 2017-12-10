// @flow
const Promise = require('bluebird')

/*::
import type Store from './store'

export type KeyPairFormat = 'jwk' | 'pem'
export type KeyPair = {
  privateKeyPem:any,
  publicKeyPem:any,
  privateKeyJwk:any
}
*/
class Keypairs {
  /*::
  store:Store
  */

  constructor(store/*: Store */) {
    this.store = store
  }

  checkAsync(keypath/*:string */, format /*:KeyPairFormat*/)/*:Promise<?KeyPair>*/ {
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

  setAsync(keypath/*:string*/, keypair/*:KeyPair*/, format/*:KeyPairFormat*/)/*:Promise<KeyPair>*/ {
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
