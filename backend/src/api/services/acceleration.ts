import { query } from '../../utils/axios-query';
import config from '../../config';

export interface Acceleration {
  txid: string,
  feeDelta: number,
}

class AccelerationApi {
  public async fetchAccelerations$(): Promise<Acceleration[]> {
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      const response = await query(`${config.MEMPOOL_SERVICES.API}/accelerations`);
      return (response as Acceleration[]) || [];
    } else {
      return [];
    }
  }
}

export default new AccelerationApi();