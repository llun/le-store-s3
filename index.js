const Store = require('./store')

module.exports.create = function (options) {
  return new Store(options)
}
