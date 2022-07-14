/*
The MIT License (MIT)

Copyright 2021 Blockstream Corp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

const WALLY_OK = 0,
  ASSET_COMMITMENT_LEN = 33,
  ASSET_GENERATOR_LEN = 33,
  ASSET_TAG_LEN = 32,
  BLINDING_FACTOR_LEN = 32;

const WASM_URL = `/resources/wallycore/wallycore.js`;

let load_promise, Module;
export function load() {
  return (
    load_promise ||
    (load_promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = WASM_URL;
      script.addEventListener("error", reject);
      script.addEventListener("load", () =>
        InitWally().then((module) => {
          Module = module;
          resolve();
        }, reject)
      );
      document.body.appendChild(script);
    }))
  );
}

// Simple wrapper to execute both asset_generator_from_bytes and asset_value_commitment,
// with hex conversions
export function generate_commitments(
  value,
  asset_hex,
  value_blinder_hex,
  asset_blinder_hex
) {
  const asset = parseHex(asset_hex, ASSET_TAG_LEN),
    value_blinder = parseHex(value_blinder_hex, BLINDING_FACTOR_LEN),
    asset_blinder = parseHex(asset_blinder_hex, BLINDING_FACTOR_LEN);

  const asset_commitment = asset_generator_from_bytes(asset, asset_blinder),
    value_commitment = asset_value_commitment(
      value,
      value_blinder,
      asset_commitment
    );

  return {
    asset_commitment: encodeHex(asset_commitment),
    value_commitment: encodeHex(value_commitment),
  };
}

export function asset_generator_from_bytes(asset, asset_blinder) {
  const asset_commitment_ptr = Module._malloc(ASSET_GENERATOR_LEN);
  checkCode(
    Module.ccall(
      "wally_asset_generator_from_bytes",
      "number",
      ["array", "number", "array", "number", "number", "number"],
      [
        asset,
        asset.length,
        asset_blinder,
        asset_blinder.length,
        asset_commitment_ptr,
        ASSET_GENERATOR_LEN,
      ]
    )
  );

  const asset_commitment = readBytes(asset_commitment_ptr, ASSET_GENERATOR_LEN);
  Module._free(asset_commitment_ptr);
  return asset_commitment;
}

export function asset_value_commitment(value, value_blinder, asset_commitment) {
  // Emscripten transforms int64 function arguments into two int32 arguments, see:
  // https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-pass-int64-t-and-uint64-t-values-from-js-into-wasm-functions
  const [value_lo, value_hi] = split_int52_lo_hi(value);

  const value_commitment_ptr = Module._malloc(ASSET_COMMITMENT_LEN);
  checkCode(
    Module.ccall(
      "wally_asset_value_commitment",
      "number",
      [
        "number",
        "number",
        "array",
        "number",
        "array",
        "number",
        "number",
        "number",
      ],
      [
        value_lo,
        value_hi,
        value_blinder,
        value_blinder.length,
        asset_commitment,
        asset_commitment.length,
        value_commitment_ptr,
        ASSET_COMMITMENT_LEN,
      ]
    )
  );

  const value_commitment = readBytes(
    value_commitment_ptr,
    ASSET_COMMITMENT_LEN
  );
  Module._free(value_commitment_ptr);
  return value_commitment;
}

function checkCode(code) {
  if (code != WALLY_OK) throw new Error(`libwally failed with code ${code}`);
}

function readBytes(ptr, size) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = Module.getValue(ptr + i, "i8");
  return bytes;
}

// Split a 52-bit JavaScript number into two 32-bits numbers for the low and high bits
// https://stackoverflow.com/a/19274574
function split_int52_lo_hi(i) {
  let lo = i | 0;
  if (lo < 0) lo += 4294967296;

  let hi = i - lo;
  hi /= 4294967296;

  if (hi < 0 || hi >= 1048576) throw new Error("not an int52: " + i);

  return [lo, hi];
}

function encodeHex(bytes) {
  // return Buffer.from(bytes).toString("hex");
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Parse hex string encoded in *reverse*
function parseHex(str, expected_size) {
  if (!/^([0-9a-f]{2})+$/.test(str))
    throw new Error("Invalid blinders (invalid hex)");
  if (str.length != expected_size * 2)
    throw new Error("Invalid blinders (invalid length)");
  return new Uint8Array(
    str
      .match(/.{2}/g)
      .map((hex_byte) => parseInt(hex_byte, 16))
      .reverse()
  );
}
