use priority_queue::PriorityQueue;
use std::{
    collections::{HashMap, HashSet},
    fmt::Debug,
    hash::{BuildHasher, Hasher},
};

/// This is the only way to create a `HashMap` with the `U32HasherState` and capacity
pub fn u32hashmap_with_capacity<V>(capacity: usize) -> HashMap<u32, V, U32HasherState> {
    HashMap::with_capacity_and_hasher(capacity, U32HasherState(()))
}

/// This is the only way to create a `PriorityQueue` with the `U32HasherState` and capacity
pub fn u32priority_queue_with_capacity<V: Ord>(
    capacity: usize,
) -> PriorityQueue<u32, V, U32HasherState> {
    PriorityQueue::with_capacity_and_hasher(capacity, U32HasherState(()))
}

/// This is the only way to create a `HashSet` with the `U32HasherState`
pub fn u32hashset_new() -> HashSet<u32, U32HasherState> {
    HashSet::with_hasher(U32HasherState(()))
}

/// A private unit type is contained so no one can make an instance of it.
#[derive(Clone)]
pub struct U32HasherState(());

impl Debug for U32HasherState {
    fn fmt(&self, _: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        Ok(())
    }
}

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
        bytemuck::cast([self.0, 0])
    }

    fn write(&mut self, bytes: &[u8]) {
        // Assert in debug builds (testing too) that only 4 byte keys (u32, i32, f32, etc.) run
        debug_assert!(bytes.len() == 4);
        // Safety: We know that the size of the key is 4 bytes
        // We also know that the only way to get an instance of HashMap using this "hasher"
        // is through the public functions in this module which set the key type to u32.
        self.0 = *bytemuck::from_bytes(bytes);
    }
}

#[cfg(test)]
mod tests {
    use super::U32HasherState;
    use priority_queue::PriorityQueue;
    use std::collections::HashMap;

    #[test]
    fn test_hashmap() {
        let mut hm: HashMap<u32, String, U32HasherState> = HashMap::with_hasher(U32HasherState(()));

        // Testing basic operations with the custom hasher
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

    #[test]
    fn test_priority_queue() {
        let mut pq: PriorityQueue<u32, i32, U32HasherState> =
            PriorityQueue::with_hasher(U32HasherState(()));

        // Testing basic operations with the custom hasher
        assert_eq!(pq.push(1, 5), None);
        assert_eq!(pq.push(2, -10), None);
        assert_eq!(pq.push(3, 7), None);
        assert_eq!(pq.push(4, 20), None);
        assert_eq!(pq.push(u32::MAX, -42), None);

        assert_eq!(pq.push_increase(1, 4), Some(4));
        assert_eq!(pq.push_increase(2, -8), Some(-10));
        assert_eq!(pq.push_increase(3, 5), Some(5));
        assert_eq!(pq.push_increase(4, 21), Some(20));
        assert_eq!(pq.push_increase(u32::MAX, -99), Some(-99));
        assert_eq!(pq.push_increase(42, 1337), None);

        assert_eq!(pq.push_decrease(1, 4), Some(5));
        assert_eq!(pq.push_decrease(2, -10), Some(-8));
        assert_eq!(pq.push_decrease(3, 5), Some(7));
        assert_eq!(pq.push_decrease(4, 20), Some(21));
        assert_eq!(pq.push_decrease(u32::MAX, 100), Some(100));
        assert_eq!(pq.push_decrease(69, 420), None);

        assert_eq!(pq.peek(), Some((&42, &1337)));
        assert_eq!(pq.pop(), Some((42, 1337)));
        assert_eq!(pq.peek(), Some((&69, &420)));
        assert_eq!(pq.pop(), Some((69, 420)));
        assert_eq!(pq.peek(), Some((&4, &20)));
        assert_eq!(pq.pop(), Some((4, 20)));
        assert_eq!(pq.peek(), Some((&3, &5)));
        assert_eq!(pq.pop(), Some((3, 5)));
        assert_eq!(pq.peek(), Some((&1, &4)));
        assert_eq!(pq.pop(), Some((1, 4)));
        assert_eq!(pq.peek(), Some((&2, &-10)));
        assert_eq!(pq.pop(), Some((2, -10)));
        assert_eq!(pq.peek(), Some((&u32::MAX, &-42)));
        assert_eq!(pq.pop(), Some((u32::MAX, -42)));
        assert_eq!(pq.peek(), None);
        assert_eq!(pq.pop(), None);
    }
}
