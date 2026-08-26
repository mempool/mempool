/** napi-rs generates index.js which natively doesn't have the freebsd-arm64/aarch64 entry
 *  even though napi-rs *.node builds and runs so we wrap it here
 */
const { existsSync } = require('fs')
const { resolveBinding } = require('./binding-name.js')

const nativeBinding = require(resolveBinding(__dirname, existsSync))

const { GbtGenerator, GbtResult } = nativeBinding
module.exports.GbtGenerator = GbtGenerator
module.exports.GbtResult = GbtResult
