# le-store-s3

Store [node-greenlock](https://github.com/Daplie/node-greenlock) certificates and account information in S3

## Using

```js
const S3 = {
  bucketName: 'letsencrypt'
}

const store = require('le-store-s3').create({ S3 })
const challenge = require('le-challenge-s3').create({ S3 })

const instance = LE.create({
  store,
  challenges: { 'http-01': challenge },
  challengeType: 'http-01',
  agreeToTerms (opts, callback) {
    callback(null, opts.tosUrl)
  }
})
instance.register({
  domains: ['awesome.domain'],
  email: 'green@rabbit.candy',
  agreeTos: true,
  rsaKeySize: 2048,
  challengeType: 'http-01'
})
```

## License

ISC
