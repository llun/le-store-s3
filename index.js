const Store = require('./store')

module.exports.create = function (options) {
  let store = new Store(options)
  return store
}
