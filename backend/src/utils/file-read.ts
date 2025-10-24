import * as fs from 'fs';
import logger from '../logger';
import config from '../config';

const CHUNK_SIZE = 1024;
const MAX_WINDOW_SIZE = 50 * CHUNK_SIZE;
const MAX_ITERATIONS = 100;

function extractDateFromLogLine(line: string): number | undefined {
  // Extract time from log: "2021-08-31T12:34:56Z" or "2021-08-31T12:34:56.123456Z"
  const dateMatch = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{6})?Z/);
  if (!dateMatch) {
    return undefined;
  }

  const dateStr = dateMatch[0];
  const date = new Date(dateStr);
  const timestamp = Math.floor(date.getTime() / 1000); // Remove decimal (microseconds are added later)

  const timePart = dateStr.split('T')[1];
  const microseconds = timePart.split('.')[1] || '';

  if (!microseconds) {
    return timestamp;
  }

  return parseFloat(timestamp + '.' + microseconds);
}

function readLineAt(fd: number, startPos: number): { line: string; startPos: number; nextPos: number } | null {
  const size = fs.fstatSync(fd).size;
  if (startPos >= size) {
    return null;
  }

  const chunks: Buffer[] = [];
  let length = 0;

  if (startPos > 0) {
    let searchPos = startPos;
    let found = false;
    let count = 0;

    while (searchPos > 0 && !found && count < 5) {
      const chunkSize = Math.min(CHUNK_SIZE, searchPos);
      const buf = Buffer.allocUnsafe(chunkSize);
      const bytesRead = fs.readSync(fd, buf, 0, chunkSize, searchPos - chunkSize);

      if (count === 0 && bytesRead > 0 && buf[bytesRead - 1] === 0x0a) {
        // startPos is already at a line boundary, no need to search backward
        found = true;
        break;
      }

      const nl = buf.lastIndexOf(0x0a, bytesRead - 1);
      if (nl !== -1) {
        startPos = searchPos - chunkSize + nl + 1;
        const slice = buf.subarray(nl + 1, bytesRead);
        chunks.unshift(slice);
        length += slice.length;
        found = true;
      } else {
        searchPos -= chunkSize;
        const slice = buf.subarray(0, bytesRead);
        chunks.unshift(slice);
        length += slice.length;
        count++;
      }
    }
    if (!found && chunks.length > 0) {
      startPos = searchPos;
    }
  }

  // Read forward until the end of the line
  let pos = startPos + length;
  while (pos < size) {
    const toRead = Math.min(CHUNK_SIZE, size - pos);
    const buf = Buffer.allocUnsafe(toRead);
    const n = fs.readSync(fd, buf, 0, toRead, pos);
    if (n <= 0) {
      break;
    }
    const slice = buf.subarray(0, n);
    const idx = slice.indexOf(0x0a);
    if (idx !== -1) {
      const finalSlice = slice.subarray(0, idx);
      chunks.push(finalSlice);
      length += finalSlice.length;
      const line = Buffer.concat(chunks, length).toString('utf8');
      const nextPos = pos + idx + 1;
      return { line, startPos, nextPos };
    } else {
      chunks.push(slice);
      length += slice.length;
      pos += n;
    }
  }
  if (chunks.length === 0) {
    return null;
  }
  const line = Buffer.concat(chunks, length).toString('utf8');
  return { line, startPos, nextPos: size };
}

function findTimestampPosition(fd: number, targetTimestamp: number): number {
  const size = fs.fstatSync(fd).size;
  let low = 0;
  let high = size;
  let iterations = 0;

  while (low < high && iterations < MAX_ITERATIONS) {
    iterations++;
    const mid = Math.floor((low + high) / 2);

    let record = readLineAt(fd, mid);
    if (!record) {
      throw new Error(`Failed to read log line during binary search`);
    }

    let ts = extractDateFromLogLine(record.line);

    if (ts === undefined) { // usually caused by empty lines between Core restarts, keep reading forward until we find a correct line
      let attempts = 0;
      while (attempts < 10) {
        record = readLineAt(fd, record.nextPos);
        if (!record) {
          break; // should not happen
        }
        ts = extractDateFromLogLine(record.line);
        if (ts) {
          break;
        }
        attempts++;
      }
      if (!record || !ts) {
        break; // should not happen
      }
    }

    if (ts < targetTimestamp) {
      low = record.nextPos;
    } else {
      high = record.startPos;
    }
  }

  return Math.min(low, size);
}

/** 
 * Perform a bounded middle-out search for the first seen time of a block within a time window
 * Stops when:
 * - EOF is reached in either direction
 * - A first-seen line is found
 * - The time window is exhausted in the respective direction
 * - MAX_WINDOW_SIZE bytes have been scanned
 *
 * @param fd file descriptor of the log file
 * @param anchor starting point of the middle-out search
 * @param startTimestamp min timestamp of the backward search
 * @param endTimestamp max timestamp of the forward search
 * @param hash block hash to search for
 * @returns timestamp when the block was first seen, or undefined if not found
 */
function searchForFirstSeen(fd: number, anchor: number, startTimestamp: number, endTimestamp: number, hash: string): number {
  const size = fs.fstatSync(fd).size;
  const half = Math.floor(MAX_WINDOW_SIZE / 2);
  const minOffset = Math.max(0, anchor - half);
  const maxOffset = Math.min(size, anchor + half);

  const headerNeedle = `Saw new header hash=${hash}`;
  const cmpctNeedle = `Saw new cmpctblock header hash=${hash}`;
  const partNeedle = `Initialized PartiallyDownloadedBlock for block ${hash}`;
  const updateNeedle = `UpdateTip: new best=${hash}`;

  let fPos = anchor;
  let fDone = fPos >= maxOffset;
  let bPos = anchor - 1;
  let bDone = bPos <= minOffset;

  let bestMatch = 1;

  while (!fDone || !bDone) {
    if (!fDone && fPos < maxOffset) {
      const forwardLimit = Math.min(maxOffset, fPos + CHUNK_SIZE);
      while (fPos < forwardLimit) {
        const record = readLineAt(fd, fPos);
        if (!record) {
          fDone = true;
          break;
        }
        const { line, nextPos } = record;
        fPos = nextPos;

        const logTimestamp = extractDateFromLogLine(line);
        if (logTimestamp === undefined) {
          continue;
        }
        if (logTimestamp > endTimestamp) {
          fDone = true;
          break;
        }

        if (line.includes(headerNeedle) || line.includes(cmpctNeedle)) {
          return logTimestamp;
        }
        if ((line.includes(partNeedle) || line.includes(updateNeedle)) && (bestMatch === 1 || logTimestamp < bestMatch)) {
          bestMatch = logTimestamp;
        }
      }
    } else {
      fDone = true;
    }

    if (!bDone && bPos > minOffset) {
      const backwardLimit = Math.max(minOffset, bPos - CHUNK_SIZE);
      while (bPos > backwardLimit) {
        const record = readLineAt(fd, bPos);
        if (!record) {
          bDone = true;
          break;
        }
        const { line, startPos } = record;
        bPos = startPos - 1;

        const logTimestamp = extractDateFromLogLine(line);
        if (logTimestamp === undefined) {
          continue;
        }
        if (logTimestamp < startTimestamp) {
          bDone = true;
          break;
        }

        if (line.includes(headerNeedle) || line.includes(cmpctNeedle)) {
          return logTimestamp;
        }
        if (line.includes(partNeedle) || line.includes(updateNeedle)) {
          bestMatch = logTimestamp;
        }
      }
    } else {
      bDone = true;
    }
  }
  return bestMatch;
}

export function getBlockFirstSeenFromLogs(hash: string, blockTimestamp: number, oldestLogTimestamp: number): number {
  const debugLogPath = config.CORE_RPC.DEBUG_LOG_PATH;
  if (!debugLogPath || blockTimestamp + 7200 <= oldestLogTimestamp) {
    return 1;
  }

  const fd = fs.openSync(debugLogPath, 'r');
  try {
    const start = blockTimestamp - 7200; // block time can be up to 2 hours in the future
    if (blockTimestamp + 3600 > (Date.now() / 1000)) { // Recent block: search the end of the log for recent blocks
      const EOF = fs.fstatSync(fd).size;
      return searchForFirstSeen(fd, EOF, start, Number.MAX_SAFE_INTEGER, hash);
    }

    // Older block but still within log range: do a binary search to find the right window
    const end = blockTimestamp + 3600; // block time can be up to 1 hour in the past (approximating median past time)
    const anchor = findTimestampPosition(fd, blockTimestamp);
    return searchForFirstSeen(fd, anchor, start, end, hash);
  } catch (e) {
    logger.debug(`Cannot parse block first seen time from Core logs. Reason: ${e instanceof Error ? e.message : e}`);
    return 1;
  } finally {
    fs.closeSync(fd);
  }
}

export function getOldestLogTimestampFromLogs(filePath: string): number | undefined {
  const fd = fs.openSync(filePath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (size === 0) {
      return undefined;
    }

    let pos = 0;
    for (let i = 0; i < 10 && pos < size; i++) {
      const record = readLineAt(fd, pos);
      if (!record) {
        break;
      }
      const ts = extractDateFromLogLine(record.line);
      if (ts !== undefined) {
        return ts;
      }
      pos = record.nextPos;
    }
    return undefined;
  } finally {
    fs.closeSync(fd);
  }
}