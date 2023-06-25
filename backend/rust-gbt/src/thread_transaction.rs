use bytes::buf::Buf;
use std::io::Cursor;

pub struct ThreadTransaction {
    pub uid: u32,
    pub fee: u64,
    pub weight: u32,
    pub sigops: u32,
    pub fee_per_vsize: f64,
    pub effective_fee_per_vsize: f64,
    pub inputs: Vec<u32>,
}

impl ThreadTransaction {
    pub fn batch_from_buffer(buffer: &[u8]) -> Vec<Self> {
        let mut transactions: Vec<Self> = Vec::new();
        let mut cursor = Cursor::new(buffer);
        let size = cursor.get_u32();
        for _ in 0..size {
            let uid = cursor.get_u32();
            let fee = cursor.get_f64().round() as u64;
            let weight = cursor.get_u32();
            let sigops = cursor.get_u32();
            let fee_per_vsize = cursor.get_f64();
            let effective_fee_per_vsize = cursor.get_f64();
            let input_count = cursor.get_u32();
            let mut inputs: Vec<u32> = Vec::new();
            for _ in 0..input_count {
                inputs.push(cursor.get_u32());
            }
            transactions.push(Self {
                uid,
                fee,
                weight,
                sigops,
                fee_per_vsize,
                effective_fee_per_vsize,
                inputs,
            });
        }

        transactions
    }
}
