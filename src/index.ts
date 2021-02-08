import fees from './fees';
import mempool from './mempool';
import blocks from './blocks';
import transactions from './transactions';
import addresses from './addresses';

export { default as fees } from './fees';
export { default as mempool } from './mempool';
export { default as blocks } from './blocks';
export { default as transactions } from './transactions';
export { default as addresses } from './addresses';

export default {
  fees,
  mempool,
  blocks,
  transactions,
  addresses,
};
