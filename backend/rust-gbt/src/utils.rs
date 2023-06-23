extern crate bytes;
use std::io::Cursor;
use bytes::buf::Buf;

pub fn txids_from_buffer(buffer: &[u8]) -> Vec<u32> {
  let mut txids: Vec<u32> = Vec::new();
  let mut cursor = Cursor::new(buffer);
  let size = cursor.get_u32();
  for _ in 0..size {
    txids.push(cursor.get_u32());
  }

  return txids;
}