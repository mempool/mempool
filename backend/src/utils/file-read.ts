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

function readLineAt(fd: number, startPos: number, assumeStartOfLine = false): { line: string; startPos: number; nextPos: number } | null {
  const size = fs.fstatSync(fd).size;
  if (startPos >= size) {
    return null;
  }

  const chunks: Buffer[] = [];
  let length = 0;

  if (startPos > 0 && !assumeStartOfLine) {
    // Cheap guard: if the previous byte is '\n' we are already aligned
    const preceding = Buffer.allocUnsafe(1);
    const read = fs.readSync(fd, preceding, 0, 1, startPos - 1);
    if (read === 1 && preceding[0] === 0x0a) {
      assumeStartOfLine = true;
    }

    if (!assumeStartOfLine) {
      let searchPos = startPos;
      let found = false;
      let count = 0;

      while (searchPos > 0 && !found && count < 5) {
        const chunkSize = Math.min(CHUNK_SIZE, searchPos);
        const buf = Buffer.allocUnsafe(chunkSize);
        const bytesRead = fs.readSync(fd, buf, 0, chunkSize, searchPos - chunkSize);

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
        record = readLineAt(fd, record.nextPos, true);
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
 * @returns timestamp and next file position when the block was first seen, or null if not found
 */
function searchForFirstSeen(fd: number, anchor: number, startTimestamp: number, endTimestamp: number, hash: string): { timestamp: number; nextPos: number; } | null {
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

  let bestMatch: { timestamp: number; nextPos: number; } | null = null;

  while (!fDone || !bDone) {
    if (!fDone && fPos < maxOffset) {
      const forwardLimit = Math.min(maxOffset, fPos + CHUNK_SIZE);
      while (fPos < forwardLimit) {
        const record = readLineAt(fd, fPos, fPos !== anchor);
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
          return { timestamp: logTimestamp, nextPos };
        }
        if ((line.includes(partNeedle) || line.includes(updateNeedle)) && !bestMatch) {
          bestMatch = { timestamp: logTimestamp, nextPos };
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
        const { line, startPos, nextPos } = record;
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
          return { timestamp: logTimestamp, nextPos };
        }
        if (line.includes(partNeedle) || line.includes(updateNeedle)) {
          bestMatch = { timestamp: logTimestamp, nextPos };
        }
      }
    } else {
      bDone = true;
    }
  }
  return bestMatch;
}

export function getBlockFirstSeenFromLogs(hash: string, blockTimestamp: number, oldestLogTimestamp: number): number | null {
  const debugLogPath = config.CORE_RPC.DEBUG_LOG_PATH;
  if (!debugLogPath || blockTimestamp + 3600 <= oldestLogTimestamp) {
    return null;
  }

  const fd = fs.openSync(debugLogPath, 'r');
  try {
    const EOF = fs.fstatSync(fd).size;
    const now = Date.now() / 1000;
    const start = blockTimestamp - 7200;
    const end = blockTimestamp + 3600 > now ? Number.MAX_SAFE_INTEGER : blockTimestamp + 3600;
    const anchor = end === Number.MAX_SAFE_INTEGER ? EOF : findTimestampPosition(fd, blockTimestamp);
    return searchForFirstSeen(fd, anchor, start, end, hash)?.timestamp ?? null;
  } catch (e) {
    logger.debug(`Cannot parse block first seen time from Core logs. Reason: ${e instanceof Error ? e.message : e}`);
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

export function scanLogsForBlocksFirstSeen(blocks: { hash: string; timestamp: number }[], oldestLogTimestamp: number): { hash: string; firstSeen: number | null }[] {
  const debugLogPath = config.CORE_RPC.DEBUG_LOG_PATH;
  if (!debugLogPath) {
    return blocks.map(block => ({ hash: block.hash, firstSeen: null }));
  }

  if (blocks.length < 5000) { // for small batches, individually binary-search each block's first seen time
    return blocks.map(block => ({ hash: block.hash, firstSeen: getBlockFirstSeenFromLogs(block.hash, block.timestamp, oldestLogTimestamp) }));
  }

  const firstSeenMap = new Map<string, number | null>();
  const missing = new Map<string, { start: number; end: number }>();

  let startTimestamp = Number.POSITIVE_INFINITY;
  for (const block of blocks) {
    firstSeenMap.set(block.hash, null);

    if (block.timestamp + 3600 > oldestLogTimestamp) {
      const start = block.timestamp - 7200;
      const end = block.timestamp + 3600;

      missing.set(block.hash, { start, end });
      if (start < startTimestamp) {
        startTimestamp = start;
      }
    }
  }

  if (!missing.size) {
    return blocks.map(block => ({ hash: block.hash, firstSeen: null }));
  }

  const extractHash = (line: string, prefix: string): string | null => {
    const idx = line.indexOf(prefix);
    if (idx === -1) {
      return null;
    }
    const fragment = line.slice(idx + prefix.length);
    const match = fragment.match(/^[0-9a-fA-F]{64}/);
    return match ? match[0] : null;
  };

  try {
    const fd = fs.openSync(debugLogPath, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      if (!size) {
        return blocks.map(block => ({ hash: block.hash, firstSeen: null }));
      }

      for (let record = readLineAt(fd, findTimestampPosition(fd, startTimestamp)); record; record = readLineAt(fd, record.nextPos, true)) {
        const { line } = record;
        const logTimestamp = extractDateFromLogLine(line);
        if (!logTimestamp) {
          continue;
        }

        let hash: string | null = null;

        if (line.includes('Saw new header hash=')) {
          hash = extractHash(line, 'Saw new header hash=');
        } else if (line.includes('Saw new cmpctblock header hash=')) {
          hash = extractHash(line, 'Saw new cmpctblock header hash=');
        } else if (line.includes('Initialized PartiallyDownloadedBlock for block ')) {
          hash = extractHash(line, 'Initialized PartiallyDownloadedBlock for block ');
        } else if (line.includes('UpdateTip: new best=')) {
          hash = extractHash(line, 'UpdateTip: new best=');
        }

        if (!hash) {
          continue;
        }

        const window = missing.get(hash);
        if (!window) {
          continue;
        }

        missing.delete(hash);
        if (logTimestamp >= window.start && logTimestamp <= window.end) {
          firstSeenMap.set(hash, logTimestamp);
        }

        if (!missing.size) {
          break;
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch (e) {
    logger.debug(`Cannot scan blocks first seen from Core logs. Reason: ${e instanceof Error ? e.message : e}`);
  }

  return blocks.map(block => ({ hash: block.hash, firstSeen: firstSeenMap.get(block.hash) ?? null }));
}

export function getOldestLogTimestampFromLogs(filePath: string): number | null {
  const fd = fs.openSync(filePath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (size === 0) {
      return null;
    }

    let pos = 0;
    for (let i = 0; i < 10 && pos < size; i++) {
      const record = readLineAt(fd, pos, true);
      if (!record) {
        break;
      }
      const ts = extractDateFromLogLine(record.line);
      if (ts !== undefined) {
        return ts;
      }
      pos = record.nextPos;
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}