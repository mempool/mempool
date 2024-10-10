/*
MIT License

Copyright (c) 2024 HAUS HOPPE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/

// Adapted from https://github.com/ordpool-space/ordpool-parser/tree/ce04d7a5b6bb1cf37b9fdadd77ba430f5bd6e7d6/src
// Utils functions to decode ord inscriptions

export const OP_FALSE = 0x00;
export const OP_IF = 0x63;
export const OP_0 = 0x00;

export const OP_PUSHBYTES_3 = 0x03; //  3 -- not an actual opcode, but used in documentation --> pushes the next 3 bytes onto the stack.
export const OP_PUSHDATA1 = 0x4c;   // 76 -- The next byte contains the number of bytes to be pushed onto the stack.
export const OP_PUSHDATA2 = 0x4d;   // 77 -- The next two bytes contain the number of bytes to be pushed onto the stack in little endian order.
export const OP_PUSHDATA4 = 0x4e;   // 78 -- The next four bytes contain the number of bytes to be pushed onto the stack in little endian order.
export const OP_ENDIF = 0x68;       // 104 -- Ends an if/else block.

export const OP_1NEGATE = 0x4f;            // 79 -- The number -1 is pushed onto the stack.
export const OP_RESERVED = 0x50;           // 80 -- Transaction is invalid unless occuring in an unexecuted OP_IF branch
export const OP_PUSHNUM_1 = 0x51;          // 81 -- also known as OP_1
export const OP_PUSHNUM_2 = 0x52;          // 82 -- also known as OP_2
export const OP_PUSHNUM_3 = 0x53;          // 83 -- also known as OP_3
export const OP_PUSHNUM_4 = 0x54;          // 84 -- also known as OP_4
export const OP_PUSHNUM_5 = 0x55;          // 85 -- also known as OP_5
export const OP_PUSHNUM_6 = 0x56;          // 86 -- also known as OP_6
export const OP_PUSHNUM_7 = 0x57;          // 87 -- also known as OP_7
export const OP_PUSHNUM_8 = 0x58;          // 88 -- also known as OP_8
export const OP_PUSHNUM_9 = 0x59;          // 89 -- also known as OP_9
export const OP_PUSHNUM_10 = 0x5a;         // 90 -- also known as OP_10
export const OP_PUSHNUM_11 = 0x5b;         // 91 -- also known as OP_11
export const OP_PUSHNUM_12 = 0x5c;         // 92 -- also known as OP_12
export const OP_PUSHNUM_13 = 0x5d;         // 93 -- also known as OP_13
export const OP_PUSHNUM_14 = 0x5e;         // 94 -- also known as OP_14
export const OP_PUSHNUM_15 = 0x5f;         // 95 -- also known as OP_15
export const OP_PUSHNUM_16 = 0x60;         // 96 -- also known as OP_16

export const OP_RETURN = 0x6a;             // 106 -- a standard way of attaching extra data to transactions is to add a zero-value output with a scriptPubKey consisting of OP_RETURN followed by data

//////////////////////////// Helper ///////////////////////////////

/**
 * Inscriptions may include fields before an optional body. Each field consists of two data pushes, a tag and a value.
 * Currently, there are six defined fields:
 */
export const knownFields = {
  // content_type, with a tag of 1, whose value is the MIME type of the body.
  content_type: 0x01,

  // pointer, with a tag of 2, see pointer docs: https://docs.ordinals.com/inscriptions/pointer.html
  pointer: 0x02,

  // parent, with a tag of 3, see provenance docs: https://docs.ordinals.com/inscriptions/provenance.html
  parent: 0x03,

  // metadata, with a tag of 5, see metadata docs: https://docs.ordinals.com/inscriptions/metadata.html
  metadata: 0x05,

  // metaprotocol, with a tag of 7, whose value is the metaprotocol identifier.
  metaprotocol: 0x07,

  // content_encoding, with a tag of 9, whose value is the encoding of the body.
  content_encoding: 0x09,

  // delegate, with a tag of 11, see delegate docs: https://docs.ordinals.com/inscriptions/delegate.html
  delegate: 0xb
}

/**
 * Retrieves the value for a given field from an array of field objects.
 * It returns the value of the first object where the tag matches the specified field.
 *
 * @param fields - An array of objects containing tag and value properties.
 * @param field - The field number to search for.
 * @returns The value associated with the first matching field, or undefined if no match is found.
 */
export function getKnownFieldValue(fields: { tag: number; value: Uint8Array }[], field: number): Uint8Array | undefined {
  const knownField = fields.find(x =>
    x.tag === field);

  if (knownField === undefined) {
    return undefined;
  }

  return knownField.value;
}

/**
 * Retrieves the values for a given field from an array of field objects.
 * It returns the values of all objects where the tag matches the specified field.
 *
 * @param fields - An array of objects containing tag and value properties.
 * @param field - The field number to search for.
 * @returns An array of Uint8Array values associated with the matching fields. If no matches are found, an empty array is returned.
 */
export function getKnownFieldValues(fields: { tag: number; value: Uint8Array }[], field: number): Uint8Array[] {
  const knownFields = fields.filter(x =>
    x.tag === field
  );

  return knownFields.map(field => field.value);
}

/**
 * Searches for the next position of the ordinal inscription mark (0063036f7264)
 * within the raw transaction data, starting from a given position.
 *
 * This function looks for a specific sequence of 6 bytes that represents the start of an ordinal inscription.
 * If the sequence is found, the function returns the index immediately following the inscription mark.
 * If the sequence is not found, the function returns -1, indicating no inscription mark was found.
 *
 * Note: This function uses a simple hardcoded approach based on the fixed length of the inscription mark.
 *
 * @returns The position immediately after the inscription mark, or -1 if not found.
 */
export function getNextInscriptionMark(raw: Uint8Array, startPosition: number): number {

  // OP_FALSE
  // OP_IF
  // OP_PUSHBYTES_3: This pushes the next 3 bytes onto the stack.
  // 0x6f, 0x72, 0x64: These bytes translate to the ASCII string "ord"
  const inscriptionMark = new Uint8Array([OP_FALSE, OP_IF, OP_PUSHBYTES_3, 0x6f, 0x72, 0x64]);

  for (let index = startPosition; index <= raw.length - 6; index++) {
    if (raw[index] === inscriptionMark[0] &&
      raw[index + 1] === inscriptionMark[1] &&
      raw[index + 2] === inscriptionMark[2] &&
      raw[index + 3] === inscriptionMark[3] &&
      raw[index + 4] === inscriptionMark[4] &&
      raw[index + 5] === inscriptionMark[5]) {
      return index + 6;
    }
  }

  return -1;
}

/////////////////////////////// Reader ///////////////////////////////

/**
 * Reads a specified number of bytes from a Uint8Array starting from a given pointer.
 *
 * @param raw - The Uint8Array from which bytes are to be read.
 * @param pointer - The position in the array from where to start reading.
 * @param n - The number of bytes to read.
 * @returns A tuple containing the read bytes as Uint8Array and the updated pointer position.
 */
export function readBytes(raw: Uint8Array, pointer: number, n: number): [Uint8Array, number] {
  const slice = raw.slice(pointer, pointer + n);
  return [slice, pointer + n];
}

/**
 * Reads data based on the Bitcoin script push opcode starting from a specified pointer in the raw data.
 * Handles different opcodes and direct push (where the opcode itself signifies the number of bytes to push).
 *
 * @param raw - The raw transaction data as a Uint8Array.
 * @param pointer - The current position in the raw data array.
 * @returns A tuple containing the read data as Uint8Array and the updated pointer position.
 */
export function readPushdata(raw: Uint8Array, pointer: number): [Uint8Array, number] {

  let [opcodeSlice, newPointer] = readBytes(raw, pointer, 1);
  const opcode = opcodeSlice[0];

  // Handle the special case of OP_0 (0x00) which pushes an empty array (interpreted as zero)
  // fixes #18
  if (opcode === OP_0) {
    return [new Uint8Array(), newPointer];
  }

  // Handle the special case of OP_1NEGATE (-1)
  if (opcode === OP_1NEGATE) {
    // OP_1NEGATE pushes the value -1 onto the stack, represented as 0x81 in Bitcoin Script
    return [new Uint8Array([0x81]), newPointer];
  }

  // Handle minimal push numbers OP_PUSHNUM_1 (0x51) to OP_PUSHNUM_16 (0x60)
  // which are used to push the values 0x01 (decimal 1) through 0x10 (decimal 16) onto the stack.
  // To get the value, we can subtract OP_RESERVED (0x50) from the opcode to get the value to be pushed.
  if (opcode >= OP_PUSHNUM_1 && opcode <= OP_PUSHNUM_16) {
    // Convert opcode to corresponding byte value
    const byteValue = opcode - OP_RESERVED;
    return [Uint8Array.from([byteValue]), newPointer];
  }

  // Handle direct push of 1 to 75 bytes (OP_PUSHBYTES_1 to OP_PUSHBYTES_75)
  if (1 <= opcode && opcode <= 75) {
    return readBytes(raw, newPointer, opcode);
  }

  let numBytes: number;
  switch (opcode) {
    case OP_PUSHDATA1: numBytes = 1; break;
    case OP_PUSHDATA2: numBytes = 2; break;
    case OP_PUSHDATA4: numBytes = 4; break;
    default:
      throw new Error(`Invalid push opcode ${opcode} at position ${pointer}`);
  }

  let [dataSizeArray, nextPointer] = readBytes(raw, newPointer, numBytes);
  let dataSize = littleEndianBytesToNumber(dataSizeArray);
  return readBytes(raw, nextPointer, dataSize);
}

//////////////////////////// Conversion ////////////////////////////

/**
 * Converts a Uint8Array containing UTF-8 encoded data to a normal a UTF-16 encoded string.
 *
 * @param bytes - The Uint8Array containing UTF-8 encoded data.
 * @returns The corresponding UTF-16 encoded JavaScript string.
 */
export function bytesToUnicodeString(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}

/**
 * Convert a Uint8Array to a string by treating each byte as a character code.
 * It avoids interpreting bytes as UTF-8 encoded sequences.
 * --> Again: it ignores UTF-8 encoding, which is necessary for binary content!
 *
 * Note: This method is different from just using `String.fromCharCode(...combinedData)` which can
 * cause a "Maximum call stack size exceeded" error for large arrays due to the limitation of
 * the spread operator in JavaScript. (previously the parser broke here, because of large content)
 *
 * @param bytes - The byte array to convert.
 * @returns The resulting string where each byte value is treated as a direct character code.
 */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let resultStr = '';
  for (let i = 0; i < bytes.length; i++) {
    resultStr += String.fromCharCode(bytes[i]);
  }
  return resultStr;
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 *
 * @param hex - A string of hexadecimal characters.
 * @returns A Uint8Array representing the hex string.
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
    bytes[j] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a hexadecimal string.
 *
 * @param bytes - A Uint8Array to convert.
 * @returns A string of hexadecimal characters representing the byte array.
 */
export function bytesToHex(bytes: Uint8Array): string {
  if (!bytes) {
    return null;
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts a little-endian byte array to a JavaScript number.
 *
 * This function interprets the provided bytes in little-endian format, where the least significant byte comes first.
 * It constructs an integer value representing the number encoded by the bytes.
 *
 * @param byteArray - An array containing the bytes in little-endian format.
 * @returns The number represented by the byte array.
 */
export function littleEndianBytesToNumber(byteArray: Uint8Array): number {
  let number = 0;
  for (let i = 0; i < byteArray.length; i++) {
    // Extract each byte from byteArray, shift it to the left by 8 * i bits, and combine it with number.
    // The shifting accounts for the little-endian format where the least significant byte comes first.
    number |= byteArray[i] << (8 * i);
  }
  return number;
}

/**
 * Concatenates multiple Uint8Array objects into a single Uint8Array.
 *
 * @param arrays - An array of Uint8Array objects to concatenate.
 * @returns A new Uint8Array containing the concatenated results of the input arrays.
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  if (arrays.length === 0) {
      return new Uint8Array();
  }

  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const array of arrays) {
      result.set(array, offset);
      offset += array.length;
  }

  return result;
}

////////////////////////////// Inscription ///////////////////////////

export interface Inscription {
  body?: Uint8Array;
  is_cropped?: boolean;
  body_length?: number;
  content_type?: Uint8Array;
  content_type_str?: string;
  delegate_txid?: string;
}

/**
 * Extracts fields from the raw data until OP_0 is encountered.
 *
 * @param raw - The raw data to read.
 * @param pointer - The current pointer where the reading starts.
 * @returns An array of fields and the updated pointer position.
 */
export function extractFields(raw: Uint8Array, pointer: number): [{ tag: number; value: Uint8Array }[], number] {

  const fields: { tag: number; value: Uint8Array }[] = [];
  let newPointer = pointer;
  let slice: Uint8Array;

  while (newPointer < raw.length &&
    // normal inscription - content follows now
    (raw[newPointer] !== OP_0) &&
    // delegate - inscription has no further content and ends directly here
    (raw[newPointer] !== OP_ENDIF)
  ) {

    // tags are encoded by ord as single-byte data pushes, but are accepted by ord as either single-byte pushes, or as OP_NUM data pushes.
    // tags greater than or equal to 256 should be encoded as little endian integers with trailing zeros omitted.
    // see: https://github.com/ordinals/ord/issues/2505
    [slice, newPointer] = readPushdata(raw, newPointer);
    const tag = slice.length === 1 ? slice[0] : littleEndianBytesToNumber(slice);

    [slice, newPointer] = readPushdata(raw, newPointer);
    const value = slice;

    fields.push({ tag, value });
  }

  return [fields, newPointer];
}


/**
 * Extracts inscription data starting from the current pointer.
 * @param raw - The raw data to read.
 * @param pointer - The current pointer where the reading starts.
 * @returns The parsed inscription or nullx
 */
export function extractInscriptionData(raw: Uint8Array, pointer: number): Inscription | null {

  try {

    let fields: { tag: number; value: Uint8Array }[];
    let newPointer: number;
    let slice: Uint8Array;

    [fields, newPointer] = extractFields(raw, pointer);

    // Now we are at the beginning of the body
    // (or at the end of the raw data if there's no body)
    if (newPointer < raw.length && raw[newPointer] === OP_0) {
      newPointer++; // Skip OP_0
    }

    // Collect body data until OP_ENDIF
    const data: Uint8Array[] = [];
    while (newPointer < raw.length && raw[newPointer] !== OP_ENDIF) {
      [slice, newPointer] = readPushdata(raw, newPointer);
      data.push(slice);
    }

    const combinedLengthOfAllArrays = data.reduce((acc, curr) => acc + curr.length, 0);
    let combinedData = new Uint8Array(combinedLengthOfAllArrays);

    // Copy all segments from data into combinedData, forming a single contiguous Uint8Array
    let idx = 0;
    for (const segment of data) {
      combinedData.set(segment, idx);
      idx += segment.length;
    }

    const contentTypeRaw = getKnownFieldValue(fields, knownFields.content_type);
    let contentType: string;

    if (!contentTypeRaw) {
      contentType = 'undefined';
    } else {
      contentType = bytesToUnicodeString(contentTypeRaw);
    }

    return {
      content_type_str: contentType,
      body: combinedData.slice(0, 100_000), // Limit body to 100 kB for now
      is_cropped: combinedData.length > 100_000,
      body_length: combinedData.length,
      delegate_txid: getKnownFieldValue(fields, knownFields.delegate) ? bytesToHex(getKnownFieldValue(fields, knownFields.delegate).reverse()) : null
    };

  } catch (ex) {
    return null;
  }
}