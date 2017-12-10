// @flow
const Promise = require('bluebird')
const path = require('path')

/*::
import type Store from './store'
import type KeyPairs, { KeyPair } from './keypairs'
import type Configs, { ConfigsArgs } from './configs'

type Pems = {
  cert: string,
  chain: string,
  privkey: string
}

type DomainArgs = {
  domainKeyPath: string
}

type CertificatePathsArgs = {
  fullchainPath: string,
  privkeyPath: string,
  certPath: string,
  chainPath: string
}

type CertificateArgs = ConfigsArgs & DomainArgs & {
  pems: Pems,
  archiveDir: string
}
*/
class Certificates {
  /*::
  store: Store
  keypairs: KeyPairs
  configs: Configs
  */

  constructor(store/*:Store*/, keypairs/*:KeyPairs*/, configs/*:Configs*/) {
    this.store = store
    this.keypairs = keypairs
    this.configs = configs
  }

  checkAsync({ fullchainPath, privkeyPath, certPath, chainPath }/*:CertificatePathsArgs*/)/*:Promise<?Pems>*/ {
    if (!fullchainPath || !privkeyPath || !certPath || !chainPath) {
      return Promise.reject(new Error('missing one or more of privkeyPath, fullchainPath, certPath, chainPath from options'))
    }

    const { s3, options } = this.store
    const Bucket = options.S3.bucketName
    return Promise.all([
      s3.getObjectAsync({ Bucket, Key: privkeyPath }),
      s3.getObjectAsync({ Bucket, Key: certPath }),
      s3.getObjectAsync({ Bucket, Key: chainPath })])
      .then(result => ({
        privkey: result[0].Body.toString('ascii'),
        cert: result[1].Body.toString('ascii'),
        chain: result[2].Body.toString('ascii')
      }))
      .catch(err => {
        if (options.debug) {
          console.error('[le-store-s3] certificates.check')
          console.error(err.stack)
        }
        return null
      })
  }

  setAsync({
    pems,
    liveDir,
    configDir,
    archiveDir,

    domains,

    certPath,
    fullchainPath,
    chainPath,
    privkeyPath,
    domainPrivateKeyPath,
    domainKeyPath,
    renewalPath,

    account,
    email,
    agreeTos,
    server,
    acmeDiscoveryUrl,
    http01Port,
    rsaKeySize
  }/*:CertificateArgs*/)/*:Promise<Pems>*/ {
    const { s3, options } = this.store
    const configs = this.configs
    const Bucket = options.S3.bucketName
    return this.configs.getAsync({
      liveDir,
      configDir,

      domains,

      certPath,
      fullchainPath,
      chainPath,
      privkeyPath,
      domainPrivateKeyPath,
      renewalPath,

      account,
      email,
      agreeTos,
      server,
      acmeDiscoveryUrl,
      http01Port,
      rsaKeySize
    })
    .then(pyobj => {
      pyobj.checkpoints = parseInt(pyobj.checkpoints, 10) || 0
      liveDir = liveDir || path.join(configDir, 'live', domains[0])
      certPath = certPath || pyobj.cert || path.join(liveDir, 'cert.pem')
      fullchainPath = fullchainPath || pyobj.fullchain || path.join(liveDir, 'fullchain.pem')
      chainPath = chainPath || pyobj.chain || path.join(liveDir, 'chain.pem')
      privkeyPath = privkeyPath || pyobj.privkey || domainKeyPath || path.join(liveDir, 'privkey.pem')

      archiveDir = archiveDir || path.join(configDir, 'archive', domains[0])

      const checkpoints = pyobj.checkpoints.toString()
      const certArchive = path.join(archiveDir, `cert${checkpoints}.pem`)
      const fullchainArchive = path.join(archiveDir, `fullchain${checkpoints}.pem`)
      const chainArchive = path.join(archiveDir, `chain${checkpoints}.pem`)
      const privkeyArchive = path.join(archiveDir, `privkey${checkpoints}.pem`)

      return Promise.all([
        s3.putObjectAsync({ Bucket, Key: certArchive, Body: pems.cert }),
        s3.putObjectAsync({ Bucket, Key: certPath, Body: pems.cert }),
        s3.putObjectAsync({ Bucket, Key: chainArchive, Body: pems.chain }),
        s3.putObjectAsync({ Bucket, Key: chainPath, Body: pems.chain }),
        s3.putObjectAsync({ Bucket, Key: fullchainArchive, Body: pems.cert + pems.chain }),
        s3.putObjectAsync({ Bucket, Key: fullchainPath, Body: pems.cert + pems.chain }),
        s3.putObjectAsync({ Bucket, Key: privkeyArchive, Body: pems.privkey }),
        s3.putObjectAsync({ Bucket, Key: privkeyPath, Body: pems.privkey })])
      .then(() => {
        pyobj.checkpoints += 1
        return configs.writeRenewalConfig({
          pyobj,
          liveDir,
          configDir,
          domains,
          certPath,
          fullchainPath,
          chainPath,
          privkeyPath,
          domainPrivateKeyPath,
          account,
          email,
          agreeTos,
          server,
          acmeDiscoveryUrl,
          http01Port,
          rsaKeySize,
          renewalPath
        })
      })
      .then(() => ({
        privkey: pems.privkey,
        cert: pems.cert,
        chain: pems.chain
      }))
    })
  }

  checkKeypairAsync({ domainKeyPath }/*:DomainArgs*/)/*:Promise<?KeyPair>*/ {
    if (!domainKeyPath) return Promise.reject(new Error('missing options.domainKeyPath'))
    return this.keypairs.checkAsync(domainKeyPath, 'pem')
  }

  setKeypairAsync({ domainKeyPath }/*:DomainArgs*/, keypair/*:KeyPair*/)/*:Promise<KeyPair>*/ {
    return this.keypairs.setAsync(domainKeyPath, keypair, 'pem')
  }
}

module.exports = Certificates
