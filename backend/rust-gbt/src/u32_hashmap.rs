use std::{
    collections::HashMap,
    hash::{BuildHasher, Hasher},
};

// Note: If needed, this will create a new HashMap without initial capacity.
// /// This is the only way to create a HashMap with the U32HasherState
// pub fn u32hashmap_new<V>() -> HashMap<u32, V, U32HasherState> {
//     HashMap::with_hasher(U32HasherState(()))
// }

/// This is the only way to create a HashMap with the U32HasherState and capacity
pub fn u32hashmap_with_capacity<V>(capacity: usize) -> HashMap<u32, V, U32HasherState> {
    HashMap::with_capacity_and_hasher(capacity, U32HasherState(()))
}

/// A private unit type is contained so no one can make an instance of it.
pub struct U32HasherState(());

impl BuildHasher for U32HasherState {
    type Hasher = U32Hasher;

    fn build_hasher(&self) -> Self::Hasher {
        U32Hasher(0)
    }
}

/// This also can't be created outside this module due to private field.
pub struct U32Hasher(u32);

impl Hasher for U32Hasher {
    fn finish(&self) -> u64 {
        // Safety: Two u32s next to each other will make a u64
        unsafe { core::mem::transmute::<(u32, u32), u64>((self.0, 0_u32)) }
    }

    fn write(&mut self, bytes: &[u8]) {
        // Assert in debug builds (testing too) that only 4 byte keys (u32, i32, f32, etc.) run
        debug_assert!(bytes.len() == 4);
        // Safety: We know that the size of the key is at least 4 bytes
        // We also know that the only way to get an instance of HashMap using this "hasher"
        // is through the public functions in this module which set the key to u32.
        self.0 = unsafe { *bytes.as_ptr().cast::<u32>() };
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::U32HasherState;

    #[test]
    fn test_me() {
        let mut hm: HashMap<u32, String, U32HasherState> = HashMap::with_hasher(U32HasherState(()));

        hm.insert(0, String::from("0"));
        hm.insert(42, String::from("42"));
        hm.insert(256, String::from("256"));
        hm.insert(u32::MAX, String::from("MAX"));
        hm.insert(u32::MAX >> 2, String::from("MAX >> 2"));

        assert_eq!(hm.get(&0), Some(&String::from("0")));
        assert_eq!(hm.get(&42), Some(&String::from("42")));
        assert_eq!(hm.get(&256), Some(&String::from("256")));
        assert_eq!(hm.get(&u32::MAX), Some(&String::from("MAX")));
        assert_eq!(hm.get(&(u32::MAX >> 2)), Some(&String::from("MAX >> 2")));
        assert_eq!(hm.get(&(u32::MAX >> 4)), None);
        assert_eq!(hm.get(&3), None);
        assert_eq!(hm.get(&43), None);
    }
}
