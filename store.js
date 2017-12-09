// @flow
const Promise = require('bluebird')
const AWS = require('aws-sdk')
const path = require('path')

const Accounts = require('./accounts')
const Certificates = require('./certificates')
const Keypairs = require('./keypairs')
const Configs = require('./configs')

const DEFAULT_OPTIONS = {
  privkeyPath: ':configDir/live/:hostname/privkey.pem',
  fullchainPath: ':configDir/live/:hostname/fullchain.pem',
  certPath: ':configDir/live/:hostname/cert.pem',
  chainPath: ':configDir/live/:hostname/chain.pem',

  configDir: 'configs',
  renewalPath: ':configDir/renewal/:hostname.conf',
  renewalDir: ':configDir/renewal/',
  accountsDir: ':configDir/accounts/:serverDir',
  serverDirGet({ server }) {
    return (server || '').replace('https://', '').replace(/(\/)$/, '').replace(/\//g, path.sep)
  },

  rsaKeySize: 2048
}

/*::
type S3 = {
  bucketName: string
}

type Options = {
  S3: S3,

  privkeyPath: string,
  fullchangePath: string,
  certPath: string,
  chainPath: string,

  configDir: string,
  renewalPath: string,
  renewalDir: string,
  accountsDir: string,

  rsaKeySize: number,

  domainKeyPath: string
}
*/

class Store {
  /*::
  s3: AWS.S3
  options: Options
  keypairs: Keypairs
  configs: Configs
  accounts: Accounts
  certificates: Certificates
  */

  constructor(options /*: Options*/) {
    this.s3 = Promise.promisifyAll(new AWS.S3(options.S3))

    options.domainKeyPath = options.domainKeyPath ||
      options.privkeyPath || DEFAULT_OPTIONS.privkeyPath
    this.options = Object.assign({}, DEFAULT_OPTIONS, options)

    if (!this.options.S3.bucketName) {
      return Promise.reject(new Error('missing bucket name in S3 options'))
    }

    this.keypairs = new Keypairs(this)
    this.configs = new Configs(this)
    this.accounts = new Accounts(this, this.keypairs)
    this.certificates = new Certificates(this, this.keypairs, this.configs)
  }

  getOptions() {
    return this.options
  }
}

module.exports = Store
