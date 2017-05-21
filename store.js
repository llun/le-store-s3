const Promise = require('bluebird')
const AWS = require('aws-sdk')
const path = require('path')

const Accounts = require('./accounts')
const Certificates = require('./certificates')
const Keypairs = require('./keypairs')

const DEFAULT_OPTIONS = {
  privkeyPath: 'live/:hostname/privkey.pem',
  fullchainPath: 'live/:hostname/fullchain.pem',
  certPath: 'live/:hostname/cert.pem',
  chainPath: 'live/:hostname/chain.pem',

  accountsDir: 'accounts/:serverDir',
  serverDirGet({ server }) {
    return (server || '').replace('https://', '').replace(/(\/)$/, '').replace(/\//g, path.sep)
  }
}

class Store {
  constructor(options) {
    this.s3 = Promise.promisifyAll(new AWS.S3(options.S3))

    options.domainKeyPath = options.domainKeyPath ||
      options.privkeyPath || DEFAULT_OPTIONS.privkeyPath
    this.options = Object.assign({}, DEFAULT_OPTIONS, options)

    if (!this.options.S3.bucketName) {
      return Promise.reject(new Error('missing bucket name in S3 options'))
    }

    this.keypairs = new Keypairs(this)
    this.accounts = new Accounts(this, this.keypairs)
    this.certificates = new Certificates(this)
  }

  getOptions() {
    return this.options
  }
}

module.exports = Store
