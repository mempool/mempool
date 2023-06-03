import { query } from '../../utils/axios-query';
import config from '../../config';
import { BlockExtended, PoolTag } from '../../mempool.interfaces';

export interface Acceleration {
  txid: string,
  feeDelta: number,
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

  public async $fetchPools(): Promise<PoolTag[]> {
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      const response = await query(`${config.MEMPOOL_SERVICES.API}/partners`);
      return (response as PoolTag[]) || [];
    } else {
      return [];
    }
  }

  public async $isAcceleratedBlock(block: BlockExtended): Promise<boolean> {
    const pools = await this.$fetchPools();
    if (block?.extras?.pool?.id == null) {
      return false;
    }
    return pools.reduce((match, tag) => match || tag.uniqueId === block.extras.pool.id, false);
  }
}

export default new AccelerationApi();