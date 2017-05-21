const Promise = require('bluebird')

class Keypairs {
  constructor(store) {
    this.store = store
  }

  checkAsync(keypath, format) {
    console.log('[keypairs.checkAsync]')
    if (!keypath) return null
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
