use napi_derive::napi;

#[derive(Debug)]
#[napi(object)]
pub struct ThreadAcceleration {
    pub uid: u32,
    pub delta: f64, // fee delta
}
