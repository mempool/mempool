import chDatabase from '../ch-database';

export interface AddressTxRow {
  scripthash: string;
  txid: string;
  tx_position: number;
  block_height: number;
  block_timestamp: number;
  net_value: number; // sats received minus sats sent by that script in that tx
}

export interface AddressTxFilters {
  direction?: 'incoming' | 'outgoing';
  minAmount?: number;
  maxAmount?: number;
  from?: number;
  to?: number;
}

const TIMESTAMP_THRESHOLD = 500_000_000;

class AddressTxsRepository {
  /** @asyncUnsafe */
  public async $saveBlockRows(rows: AddressTxRow[]): Promise<void> {
    await chDatabase.insert(`address_txs SELECT unhex(scripthash), unhex(txid), tx_position, block_height, block_timestamp, net_value
      FROM input('scripthash String, txid String, tx_position UInt16, block_height UInt32, block_timestamp UInt32, net_value Int64')`, rows);
  }

  /** @asyncUnsafe */
  public async $getIndexedRange(): Promise<{ min: number, max: number } | null> {
    const rows = await chDatabase.query<{ min: number, max: number, count: number }>(
      'SELECT min(block_height) AS min, max(block_height) AS max, count() AS count FROM address_txs'
    );
    return rows[0]?.count > 0 ? { min: rows[0].min, max: rows[0].max } : null;
  }

  /** @asyncUnsafe */
  public async $getFilteredTxids(scripthash: string, filters: AddressTxFilters, limit: number, afterTxid?: string): Promise<string[]> {
    const conditions = ['scripthash = unhex({scripthash:String})'];
    const params: Record<string, unknown> = { scripthash, limit };

    if (filters.direction === 'incoming') {
      conditions.push('net_value > 0');
    } else if (filters.direction === 'outgoing') {
      conditions.push('net_value < 0');
    }
    if (filters.minAmount !== undefined) {
      conditions.push('abs(net_value) >= {minAmount:Int64}');
      params.minAmount = filters.minAmount;
    }
    if (filters.maxAmount !== undefined) {
      conditions.push('abs(net_value) <= {maxAmount:Int64}');
      params.maxAmount = filters.maxAmount;
    }
    if (filters.from !== undefined) {
      conditions.push(`${filters.from < TIMESTAMP_THRESHOLD ? 'block_height' : 'block_timestamp'} >= {from:UInt32}`);
      params.from = filters.from;
    }
    if (filters.to !== undefined) {
      conditions.push(`${filters.to < TIMESTAMP_THRESHOLD ? 'block_height' : 'block_timestamp'} <= {to:UInt32}`);
      params.to = filters.to;
    }

    if (afterTxid) {
      const cursor = await chDatabase.query<{ block_height: number, tx_position: number }>(
        'SELECT block_height, tx_position FROM address_txs WHERE scripthash = unhex({scripthash:String}) AND txid = unhex({afterTxid:String}) LIMIT 1',
        { scripthash, afterTxid }
      );
      if (!cursor.length) {
        throw new Error(`after_txid ${afterTxid} not found`);
      }
      conditions.push('(block_height, tx_position) < ({afterHeight:UInt32}, {afterPosition:UInt16})');
      params.afterHeight = cursor[0].block_height;
      params.afterPosition = cursor[0].tx_position;
    }

    const rows = await chDatabase.query<{ txid: string }>(
      `SELECT lower(hex(txid)) AS txid FROM address_txs
      WHERE ${conditions.join(' AND ')}
      ORDER BY block_height DESC, tx_position DESC
      LIMIT {limit:UInt32}`,
      params
    );
    return rows.map((row) => row.txid);
  }

  /** @asyncUnsafe */
  public async $deleteFromHeight(height: number): Promise<void> {
    await chDatabase.command('DELETE FROM address_txs WHERE block_height >= {height:UInt32}', { height });
  }
}

export default new AddressTxsRepository();
