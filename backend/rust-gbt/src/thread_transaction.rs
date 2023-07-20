use napi_derive::napi;

#[derive(Debug)]
#[napi(object)]
pub struct ThreadTransaction {
    pub uid: u32,
    pub order: u32,
    pub fee: f64,
    pub weight: u32,
    pub sigops: u32,
    pub effective_fee_per_vsize: f64,
    pub inputs: Vec<u32>,
}
