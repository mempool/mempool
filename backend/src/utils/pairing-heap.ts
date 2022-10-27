export type HeapNode<T> = {
  element: T
  child?: HeapNode<T>
  next?: HeapNode<T>
  prev?: HeapNode<T>
} | null | undefined;

// minimal pairing heap priority queue implementation
export class PairingHeap<T> {
  private root: HeapNode<T> = null;
  private comparator: (a: T, b: T) => boolean;

  // comparator function should return 'true' if a is higher priority than b
  constructor(comparator: (a: T, b: T) => boolean) {
    this.comparator = comparator;
  }

  isEmpty(): boolean {
    return !this.root;
  }

  add(element: T): HeapNode<T> {
    const node: HeapNode<T> = {
      element
    };

    this.root = this.meld(this.root, node);

    return node;
  }

  // returns the top priority element without modifying the queue
  peek(): T | void {
    return this.root?.element;
  }

  // removes and returns the top priority element
  pop(): T | void {
    let element;
    if (this.root) {
      const node = this.root;
      element = node.element;
      this.root = this.mergePairs(node.child);
    }
    return element;
  }

  deleteNode(node: HeapNode<T>): void {
    if (!node) {
      return;
    }

    if (node === this.root) {
      this.root = this.mergePairs(node.child);
    }
    else {
      if (node.prev) {
        if (node.prev.child === node) {
          node.prev.child = node.next;
        }
        else {
          node.prev.next = node.next;
        }
      }
      if (node.next) {
        node.next.prev = node.prev;
      }
      this.root = this.meld(this.root, this.mergePairs(node.child));
    }

    node.child = null;
    node.prev = null;
    node.next = null;
  }

  // fix the heap after increasing the priority of a given node
  increasePriority(node: HeapNode<T>): void {
    // already the top priority element
    if (!node || node === this.root) {
      return;
    }
    // extract from siblings
    if (node.prev) {
      if (node.prev?.child === node) {
        if (this.comparator(node.prev.element, node.element)) {
          // already in a valid position
          return;
        }
        node.prev.child = node.next;
      }
      else {
        node.prev.next = node.next;
      }
    }
    if (node.next) {
      node.next.prev = node.prev;
    }

    this.root = this.meld(this.root, node);
  }

  decreasePriority(node: HeapNode<T>): void {
    this.deleteNode(node);
    this.root = this.meld(this.root, node);
  }

  meld(a: HeapNode<T>, b: HeapNode<T>): HeapNode<T> {
    if (!a) {
      return b;
    }
    if (!b || a === b) {
      return a;
    }

    let parent: HeapNode<T> = b;
    let child: HeapNode<T> = a;
    if (this.comparator(a.element, b.element)) {
      parent = a;
      child = b;
    }

    child.next = parent.child;
    if (parent.child) {
      parent.child.prev = child;
    }
    child.prev = parent;
    parent.child = child;

    parent.next = null;
    parent.prev = null;

    return parent;
  }

  mergePairs(node: HeapNode<T>): HeapNode<T> {
    if (!node) {
      return null;
    }

    let current: HeapNode<T> = node;
    let next: HeapNode<T>;
    let nextCurrent: HeapNode<T>;
    let pairs: HeapNode<T>;
    let melded: HeapNode<T>;
    while (current) {
      next = current.next;
      if (next) {
        nextCurrent = next.next;
        melded = this.meld(current, next);
        if (melded) {
          melded.prev = pairs;
        }
        pairs = melded;
      }
      else {
        nextCurrent = null;
        current.prev = pairs;
        pairs = current;
        break;
      }
      current = nextCurrent;
    }

    melded = null;
    let prev: HeapNode<T>;
    while (pairs) {
      prev = pairs.prev;
      melded = this.meld(melded, pairs);
      pairs = prev;
    }

    return melded;
  }
}