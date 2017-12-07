const Promise = require('bluebird')
const pyconf = Promise.promisifyAll(require('pyconf'))
const path = require('path')

class Configs {
  constructor(store) {
    this.store = store
  }

  checkAsync({ renewalPath, pyobj }) {
    return this.checkHelperAsync({ renewalPath })
      .then(pyobj => {
        const exists = pyobj.checkpoints >= 0
        if (!exists) return null
        return this.pyToJson(pyobj)
      })
  }

  getAsync({
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
  }) {
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

  checkHelperAsync({ renewalPath }) {
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
  }) {
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

      http01Port: http01Port,
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

  pyToJson(pyobj) {
    if (!pyobj) return null

    const jsobj = {}
    Object.keys(pyobj).forEach(key => {
      jsobj[key] = pyobj[key]
    })
    delete jsobj.__lines
    delete jsobj.__keys
    return jsobj
  }
}

module.exports = Configs
