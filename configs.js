// @flow
const Promise = require('bluebird')
const pyconf = Promise.promisifyAll(require('pyconf'))
const path = require('path')

/*::
import type Store from './store'

type Account = {
  id: number
}

type PyObj = {
  cert: string,
  privkey: string,
  chain: string,
  fullchain: string,

  checkpoints: number,
  tos: boolean,
  email: string,
  domains: string,
  server: string,

  rsa_key_size: number,
  http01Port: number
}

export type ConfigsArgs = {
  liveDir: string,
  configDir: string,

  domains: Array<string>,

  certPath: string,
  fullchainPath: string,
  chainPath: string,
  privkeyPath: string,
  domainPrivateKeyPath: string,
  renewalPath: string,

  account: Account,
  email: string,
  agreeTos: boolean,
  server: string,
  acmeDiscoveryUrl: string,
  http01Port: number,
  rsaKeySize: number
}

type HelperConfigsArgs = {
  renewalPath: string,
}

type CheckConfigsArgs = HelperConfigsArgs & {
  pyobj: PyObj
}

type RenewalConfigsArgs = ConfigsArgs & {
  pyobj: PyObj
}


*/

class Configs {
  /*::
  store:Store
  */

  constructor(store/*:Store*/) {
    this.store = store
  }

  checkAsync({ renewalPath, pyobj }/*:CheckConfigsArgs*/)/*:Promise<PyObj>*/ {
    return this.checkHelperAsync({ renewalPath })
      .then(pyobj => {
        const exists = pyobj.checkpoints >= 0
        if (!exists) return null
        return this.pyToJson(pyobj)
      })
  }

  getAsync({
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
  }/*:ConfigsArgs*/) {
    return this.checkHelperAsync({ renewalPath })
      .then(pyobj => {
        const minver = pyobj.checkpoints >= 0;
        if (!minver) {
          pyobj.checkpoints = 0
          return this.writeRenewalConfig({
            pyobj,
            domains,
            liveDir,
            configDir,
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
        }

        agreeTos = (agreeTos || pyobj.tos) && true
        email = email || pyobj.email
        domains = domains || pyobj.domains

        server = server || acmeDiscoveryUrl || pyobj.server;

        certPath = certPath || pyobj.cert;
        privkeyPath = privkeyPath || pyobj.privkey;
        chainPath = chainPath || pyobj.chain;
        fullchainPath = fullchainPath || pyobj.fullchain;

        rsaKeySize = rsaKeySize || pyobj.rsaKeySize;
        http01Port = http01Port || pyobj.http01Port;
        return this.writeRenewalConfig({
          pyobj,
          domains,
          liveDir,
          configDir,
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
      })
  }

  checkHelperAsync({ renewalPath }/*:HelperConfigsArgs*/)/*:Promise<PyObj>*/ {
    const { options, s3 } = this.store
    const Bucket = options.S3.bucketName
    return s3.getObjectAsync({
      Bucket,
      Key: renewalPath
    })
    .then(data => pyconf.parseAsync(data.Body.toString()))
    .catch(() => pyconf.parseAsync('checkpoints = -1'))
  }

  writeRenewalConfig({
    pyobj,
    domains,

    liveDir,
    configDir,

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
  }/*:RenewalConfigsArgs*/)/*:Promise<PyObj>*/ {
    pyobj.checkpoints = parseInt(pyobj.checkpoints, 10) || 0

    liveDir = liveDir || path.join('live', domains[0])
    certPath = certPath || pyobj.cert || path.join(liveDir, 'cert.pem')
    fullchainPath = fullchainPath || pyobj.fullchain || path.join(liveDir, 'fullchain.pem')
    chainPath = chainPath || pyobj.chain || path.join(liveDir, 'chain.pem')

    privkeyPath = privkeyPath || pyobj.privkey || path.join(liveDir, 'privkey.pem')

    const updates = {
      account: account.id,
      configDir: configDir,
      domains,
      email,
      tos: !!agreeTos,
      webrootPath: [],
      server: server || acmeDiscoveryUrl,
      privkey: privkeyPath,
      fullchain: fullchainPath,
      cert: certPath,
      chain: chainPath,

      http01Port,
      keyPath: domainPrivateKeyPath || privkeyPath,
      rsaKeySize: rsaKeySize,
      checkpoints: pyobj.checkpoints,
      workDir: '/tmp',
      logsDir: '/tmp'
    }

    domains.forEach(hostname => {
      updates[hostname] = '/tmp'
    })

    Object.keys(updates).forEach(key => {
      // $FlowFixMe
      pyobj[key] = updates[key]
    })

    const { s3, options } = this.store
    const Bucket = options.S3.bucketName
    return pyconf.stringifyAsync(pyobj)
      .then(Body => s3.putObjectAsync({
        Bucket,
        Body,
        Key: renewalPath
      })).then(() => pyobj)
  }

  pyToJson(pyobj/*:?any*/)/*:?any*/ {
    if (!pyobj) return null

    const obj = pyobj
    const jsobj = {}
    Object.keys(obj).forEach(key => {
      jsobj[key] = obj[key]
    })
    delete jsobj.__lines
    delete jsobj.__keys
    return jsobj
  }
}

module.exports = Configs
