import config from '../../config';
import logger from '../../logger';
import { BlockExtended, PoolTag } from '../../mempool.interfaces';
import axios from 'axios';

export interface Acceleration {
  txid: string,
  feeDelta: number,
  pools: number[],
}

class AccelerationApi {
  public async $fetchAccelerations(): Promise<Acceleration[] | null> {
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      try {
        const response = await axios.get(`${config.MEMPOOL_SERVICES.API}/accelerator/accelerations`, { responseType: 'json', timeout: 10000 });
        return response.data as Acceleration[];
      } catch (e) {
        logger.warn('Failed to fetch current accelerations from the mempool services backend: ' + (e instanceof Error ? e.message : e));
        return null;
      }
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