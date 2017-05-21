const Promise = require('bluebird')

class Keypairs {
  constructor(store) {
    this.store = store
  }

  checkAsync(keypath, format) {
    console.log('[keypairs.checkAsync]*')
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

  setAsync(keypath, keypair, format) {
    console.log('[keypairs.setAsync]*')
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
