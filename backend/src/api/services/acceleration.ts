import { query } from '../../utils/axios-query';
import config from '../../config';
import { BlockExtended, PoolTag } from '../../mempool.interfaces';

export interface Acceleration {
  txid: string,
  feeDelta: number,
  pools: number[],
}

class AccelerationApi {
  public async $fetchAccelerations(): Promise<Acceleration[]> {
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      const response = await query(`${config.MEMPOOL_SERVICES.API}/accelerations`);
      return (response as Acceleration[]) || [];
    } else {
      return [];
    }
  }

  public isAcceleratedBlock(block: BlockExtended, accelerations: Acceleration[]): boolean {
    let anyAccelerated = false;
    for (let i = 0; i < accelerations.length && !anyAccelerated; i++) {
      anyAccelerated = anyAccelerated || accelerations[i].pools?.includes(block.extras.pool.id);
    }
    return anyAccelerated;
  }
}

export default new AccelerationApi();