import * as fs from 'fs';
import logger from '../logger';
import config from '../config';

function readFile(filePath: string, bufferSize?: number): string[] {
  const fileSize = fs.statSync(filePath).size;
  const chunkSize = bufferSize || fileSize;
  const fileDescriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(chunkSize);

  fs.readSync(fileDescriptor, buffer, 0, chunkSize, fileSize - chunkSize);
  fs.closeSync(fileDescriptor);

  const lines = buffer.toString('utf8', 0, chunkSize).split('\n');
  return lines;
}

function extractDateFromLogLine(line: string): number | undefined {
  // Extract time from log: "2021-08-31T12:34:56Z" or "2021-08-31T12:34:56.123456Z"
  const dateMatch = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{6})?Z/);
  if (!dateMatch) {
    return undefined;
  }

  const dateStr = dateMatch[0];
  const date = new Date(dateStr);
  let timestamp = Math.floor(date.getTime() / 1000); // Remove decimal (microseconds are added later)

  const timePart = dateStr.split('T')[1];
  const microseconds = timePart.split('.')[1] || '';

  if (!microseconds) {
    return timestamp;
  }

  return parseFloat(timestamp + '.' + microseconds);
}

export function getRecentFirstSeen(hash: string): number | undefined {
  const debugLogPath = config.CORE_RPC.DEBUG_LOG_PATH;
  if (debugLogPath) {
    try {
      // Read the last few lines of debug.log
      const lines = readFile(debugLogPath, 2048);

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line && line.includes(`Saw new header hash=${hash}`)) {
          return extractDateFromLogLine(line);
        }
      }
    } catch (e) {
      logger.err(`Cannot parse block first seen time from Core logs. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  return undefined;
}
