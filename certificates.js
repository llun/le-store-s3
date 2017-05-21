const Promise = require('bluebird')

class Certificates {
  constructor(store, keypairs) {
    this.store = store
    this.keypairs = keypairs
  }

  checkAsync({ fullchainPath, privkeyPath, certPath, chainPath }) {
    console.log('[certificates.checkAsync]')
    if (!fullchainPath || !privkeyPath || !certPath || !chainPath) {
      return Promise.reject(new Error('missing one or more of privkeyPath, fullchainPath, certPath, chainPath from options'))
    }

    console.log(privkeyPath, certPath, chainPath)

    const { s3, options } = this.store
    const Bucket = options.S3.bucketName
    return Promise.all([
      s3.getObjectAsync({ Bucket, Key: privkeyPath }),
      s3.getObjectAsync({ Bucket, Key: certPath }),
      s3.getObjectAsync({ Bucket, Key: chainPath })])
      .then(result => {
        console.log('[Certificates.check]', result)
      })
      .catch(err => {
        if (options.debug) {
          console.error('[le-store-s3] certificates.check')
          console.error(err.stack)
        }
        return null
      })
  }

  setAsync() {

  }

  checkKeypairAsync({ domainKeyPath }) {
    console.log('[certificates.checkKeypairAsync]*')
    if (!domainKeyPath) return Promise.reject(new Error('missing options.domainKeyPath'))
    return this.keypairs.checkAsync(domainKeyPath, 'pem')
  }

  setKeypairAsync({ domainKeyPath }, keypair) {
    console.log('[certificates.setKeypairAsync]*')
    return this.keypairs.setAsync(domainKeyPath, keypair, 'pem')
  }
}

module.exports = Certificates
