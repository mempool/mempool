use bytes::buf::Buf;
use std::io::Cursor;

pub fn txids_from_buffer(buffer: &[u8]) -> Vec<u32> {
    let mut txids: Vec<u32> = Vec::new();
    let mut cursor: Cursor<&[u8]> = Cursor::new(buffer);
    let size: u32 = cursor.get_u32();
    for _ in 0..size {
        txids.push(cursor.get_u32());
    }

    txids
}
