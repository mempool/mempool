const { join } = require('path')

/** napi-rs's generated loader, copied in as index.napi.js by `to-backend` script */
const NAPI_LOADER = './index.napi.js'

function localBindingName(platform = process.platform, arch = process.arch) {
  return `gbt.${platform}-${arch}.node`
}

function resolveBinding(dir, existsCb, platform = process.platform, arch = process.arch) {
  const local = join(dir, localBindingName(platform, arch))
  return existsCb(local) ? local : NAPI_LOADER
}

module.exports = { NAPI_LOADER, localBindingName, resolveBinding }
