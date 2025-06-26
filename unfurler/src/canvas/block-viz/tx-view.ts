import BlockScene from './block-scene';
import { TransactionClassified } from '../../api/mempool-api.interfaces';
import { Square } from './utils';

export default class TxView implements TransactionClassified {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
  feerate: number;
  acc?: boolean;
  rate?: number;
  flags: number;
  bigintFlags?: bigint | null = 0b00000100_00000000_00000000_00000000n;
  time?: number;
  status?: 'found' | 'missing' | 'sigop' | 'fresh' | 'freshcpfp' | 'added' | 'added_prioritized' | 'prioritized' | 'added_deprioritized' | 'deprioritized' | 'censored' | 'selected' | 'rbf' | 'accelerated';
  context?: 'projected' | 'actual';
  scene?: BlockScene;

  screenPosition: Square;
  gridPosition: Square | null = null;

  constructor(tx: TransactionClassified, scene: BlockScene) {
    this.scene = scene;
    this.txid = tx.txid;
    this.time = tx.time || 0;
    this.fee = tx.fee;
    this.vsize = tx.vsize;
    this.value = tx.value;
    this.feerate = tx.rate || (tx.fee / tx.vsize); // sort by effective fee rate where available
    this.acc = tx.acc;
    this.rate = tx.rate;
    this.flags = tx.flags || 0;
    this.bigintFlags = tx.flags ? BigInt(tx.flags) : 0n;
    this.screenPosition = { x: 0, y: 0, s: 0 };
  }

  applyGridPosition(position: Square): void {
    if (!this.gridPosition) {
      this.gridPosition = { x: 0, y: 0, s: 0 };
    }
    if (this.gridPosition.x !== position.x || this.gridPosition.y !== position.y || this.gridPosition.s !== position.s) {
      this.gridPosition.x = position.x;
      this.gridPosition.y = position.y;
      this.gridPosition.s = position.s;
    }
  }
}
