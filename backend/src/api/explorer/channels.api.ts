import logger from '../../logger';
import DB from '../../database';
import nodesApi from './nodes.api';
import { ResultSetHeader } from 'mysql2';
import { ILightningApi } from '../lightning/lightning-api.interface';
import { Common } from '../common';

class ChannelsApi {
  public async $getAllChannels(): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getAllChannels error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getAllChannelsGeo(publicKey?: string, style?: string): Promise<any[]> {
    try {
      let select: string;
      if (style === 'widget') {
        select = `
          nodes_1.latitude AS node1_latitude, nodes_1.longitude AS node1_longitude,
          nodes_2.latitude AS node2_latitude, nodes_2.longitude AS node2_longitude
        `;
      } else {
        select = `
          nodes_1.public_key as node1_public_key, nodes_1.alias AS node1_alias,
          nodes_1.latitude AS node1_latitude, nodes_1.longitude AS node1_longitude,
          nodes_2.public_key as node2_public_key, nodes_2.alias AS node2_alias,
          nodes_2.latitude AS node2_latitude, nodes_2.longitude AS node2_longitude
        `;
      }

      const params: string[] = [];
      let query = `SELECT ${select}
        FROM channels
        JOIN nodes AS nodes_1 on nodes_1.public_key = channels.node1_public_key
        JOIN nodes AS nodes_2 on nodes_2.public_key = channels.node2_public_key
        WHERE channels.status = 1
          AND nodes_1.latitude IS NOT NULL AND nodes_1.longitude IS NOT NULL
          AND nodes_2.latitude IS NOT NULL AND nodes_2.longitude IS NOT NULL
      `;

      if (publicKey !== undefined) {
        query += ' AND (nodes_1.public_key = ? OR nodes_2.public_key = ?)';
        params.push(publicKey);
        params.push(publicKey);
      } else {
        query += ` AND channels.capacity > 1000000
          GROUP BY nodes_1.public_key, nodes_2.public_key
          ORDER BY channels.capacity DESC
          LIMIT 10000
        `;        
      }

      const [rows]: any = await DB.query(query, params);
      return rows.map((row) => {
        if (style === 'widget') {
          return [
            row.node1_longitude, row.node1_latitude,
            row.node2_longitude, row.node2_latitude,
          ];
        } else {
          return [
            row.node1_public_key, row.node1_alias,
            row.node1_longitude, row.node1_latitude,
            row.node2_public_key, row.node2_alias,
            row.node2_longitude, row.node2_latitude,
          ];
        }
      });
    } catch (e) {
      logger.err('$getAllChannelsGeo error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $searchChannelsById(search: string): Promise<any[]> {
    try {
      // restrict search to valid id/short_id prefix formats
      let searchStripped = search.match(/^[0-9]+[0-9x]*$/)?.[0] || '';
      if (!searchStripped.length) {
        return [];
      }
      // add wildcard to search by prefix
      searchStripped += '%';
      const query = `SELECT id, short_id, capacity, status FROM channels WHERE id LIKE ? OR short_id LIKE ? LIMIT 10`;
      const [rows]: any = await DB.query(query, [searchStripped, searchStripped]);
      return rows;
    } catch (e) {
      logger.err('$searchChannelsById error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsByStatus(status: number | number[]): Promise<any[]> {
    try {
      let query: string;
      if (Array.isArray(status)) {
        query = `SELECT * FROM channels WHERE status IN (${status.join(',')})`;
      } else {
        query = `SELECT * FROM channels WHERE status = ?`;
      }
      const [rows]: any = await DB.query(query, [status]);
      return rows;
    } catch (e) {
      logger.err('$getChannelsByStatus error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getClosedChannelsWithoutReason(): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels WHERE status = 2 AND closing_reason IS NULL AND closing_transaction_id != ''`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getClosedChannelsWithoutReason error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getPenaltyClosedChannels(): Promise<any[]> {
    try {
      const query = `
        SELECT n1.alias AS alias_left,
          n2.alias AS alias_right,
          channels.*
        FROM channels
        LEFT JOIN nodes AS n1 ON n1.public_key = channels.node1_public_key
        LEFT JOIN nodes AS n2 ON n2.public_key = channels.node2_public_key
        WHERE channels.status = 2 AND channels.closing_reason = 3
        ORDER BY closing_date DESC
      `;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getPenaltyClosedChannels error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getUnresolvedClosedChannels(): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels WHERE status = 2 AND closing_reason = 2 AND closing_resolved = 0 AND closing_transaction_id != ''`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getUnresolvedClosedChannels error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsWithoutSourceChecked(): Promise<any[]> {
    try {
      const query = `
        SELECT channels.*
        FROM channels
        WHERE channels.source_checked != 1
      `;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getUnresolvedClosedChannels error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsWithoutCreatedDate(): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels WHERE created IS NULL`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getChannelsWithoutCreatedDate error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannel(id: string): Promise<any> {
    try {
      const query = `
        SELECT n1.alias AS alias_left, n1.longitude as node1_longitude, n1.latitude as node1_latitude,
          n2.alias AS alias_right, n2.longitude as node2_longitude, n2.latitude as node2_latitude,
          channels.*,
          ns1.channels AS channels_left, ns1.capacity AS capacity_left, ns2.channels AS channels_right, ns2.capacity AS capacity_right
        FROM channels
        LEFT JOIN nodes AS n1 ON n1.public_key = channels.node1_public_key
        LEFT JOIN nodes AS n2 ON n2.public_key = channels.node2_public_key
        LEFT JOIN node_stats AS ns1 ON ns1.public_key = channels.node1_public_key
        LEFT JOIN node_stats AS ns2 ON ns2.public_key = channels.node2_public_key
        WHERE (
          ns1.id = (
            SELECT MAX(id)
            FROM node_stats
            WHERE public_key = channels.node1_public_key
          )
          AND ns2.id = (
            SELECT MAX(id)
            FROM node_stats
            WHERE public_key = channels.node2_public_key
          )
        )
        AND channels.id = ?
      `;

      const [rows]: any = await DB.query(query, [id]);
      if (rows[0]) {
        return this.convertChannel(rows[0]);
      }
    } catch (e) {
      logger.err('$getChannel error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsStats(): Promise<any> {
    try {
      // Feedback from zerofeerouting:
      // "I would argue > 5000ppm can be ignored. Channels charging more than .5% fee are ignored by CLN for example."
      const ignoredFeeRateThreshold = 5000;
      const ignoredBaseFeeThreshold = 5000;

      // Capacity
      let query = `SELECT AVG(capacity) AS avgCapacity FROM channels WHERE status = 1 ORDER BY capacity`;
      const [avgCapacity]: any = await DB.query(query);

      query = `SELECT capacity FROM channels WHERE status = 1 ORDER BY capacity`;
      let [capacity]: any = await DB.query(query);
      capacity = capacity.map(capacity => capacity.capacity);
      const medianCapacity = capacity[Math.floor(capacity.length / 2)];

      // Fee rates
      query = `SELECT node1_fee_rate FROM channels WHERE node1_fee_rate < ${ignoredFeeRateThreshold} AND status = 1`;
      let [feeRates1]: any = await DB.query(query);
      feeRates1 = feeRates1.map(rate => rate.node1_fee_rate);
      query = `SELECT node2_fee_rate FROM channels WHERE node2_fee_rate < ${ignoredFeeRateThreshold} AND status = 1`;
      let [feeRates2]: any = await DB.query(query);
      feeRates2 = feeRates2.map(rate => rate.node2_fee_rate);

      let feeRates = (feeRates1.concat(feeRates2)).sort((a, b) => a - b);
      let avgFeeRate = 0;
      for (const rate of feeRates) {
        avgFeeRate += rate; 
      }
      avgFeeRate /= feeRates.length;
      const medianFeeRate = feeRates[Math.floor(feeRates.length / 2)];

      // Base fees
      query = `SELECT node1_base_fee_mtokens FROM channels WHERE node1_base_fee_mtokens < ${ignoredBaseFeeThreshold} AND status = 1`;
      let [baseFees1]: any = await DB.query(query);
      baseFees1 = baseFees1.map(rate => rate.node1_base_fee_mtokens);
      query = `SELECT node2_base_fee_mtokens FROM channels WHERE node2_base_fee_mtokens < ${ignoredBaseFeeThreshold} AND status = 1`;
      let [baseFees2]: any = await DB.query(query);
      baseFees2 = baseFees2.map(rate => rate.node2_base_fee_mtokens);

      let baseFees = (baseFees1.concat(baseFees2)).sort((a, b) => a - b);
      let avgBaseFee = 0;
      for (const fee of baseFees) {
        avgBaseFee += fee; 
      }
      avgBaseFee /= baseFees.length;
      const medianBaseFee = feeRates[Math.floor(baseFees.length / 2)];
      
      return {
        avgCapacity: parseInt(avgCapacity[0].avgCapacity, 10),
        avgFeeRate: avgFeeRate,
        avgBaseFee: avgBaseFee,
        medianCapacity: medianCapacity,
        medianFeeRate: medianFeeRate,
        medianBaseFee: medianBaseFee,
      }

    } catch (e) {
      logger.err(`Cannot calculate channels statistics. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $getChannelsByTransactionId(transactionIds: string[]): Promise<any[]> {
    try {
      const query = `
        SELECT n1.alias AS alias_left, n2.alias AS alias_right, channels.*
        FROM channels
        LEFT JOIN nodes AS n1 ON n1.public_key = channels.node1_public_key
        LEFT JOIN nodes AS n2 ON n2.public_key = channels.node2_public_key
        WHERE channels.transaction_id IN ? OR channels.closing_transaction_id IN ?
      `;
      const [rows]: any = await DB.query(query, [[transactionIds], [transactionIds]]);
      const channels = rows.map((row) => this.convertChannel(row));
      return channels;
    } catch (e) {
      logger.err('$getChannelByTransactionId error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelByClosingId(transactionId: string): Promise<any> {
    try {
      const query = `
        SELECT
          channels.*
        FROM channels
        WHERE channels.closing_transaction_id = ?
      `;
      const [rows]: any = await DB.query(query, [transactionId]);
      if (rows.length > 0) {
        rows[0].outputs = JSON.parse(rows[0].outputs);
        return rows[0];
      }
    } catch (e) {
      logger.err('$getChannelByClosingId error: ' + (e instanceof Error ? e.message : e));
      // don't throw - this data isn't essential
    }
  }

  public async $getChannelsByOpeningId(transactionId: string): Promise<any> {
    try {
      const query = `
        SELECT
          channels.*
        FROM channels
        WHERE channels.transaction_id = ?
      `;
      const [rows]: any = await DB.query(query, [transactionId]);
      if (rows.length > 0) {
        return rows.map(row => {
          row.outputs = JSON.parse(row.outputs);
          return row;
        });
      }
    } catch (e) {
      logger.err('$getChannelsByOpeningId error: ' + (e instanceof Error ? e.message : e));
      // don't throw - this data isn't essential
    }
  }

  public async $updateClosingInfo(channelInfo: { id: string, node1_closing_balance: number, node2_closing_balance: number, closed_by: string | null, closing_fee: number, outputs: ILightningApi.ForensicOutput[]}): Promise<void> {
    try {
      const query = `
        UPDATE channels SET
          node1_closing_balance = ?,
          node2_closing_balance = ?,
          closed_by = ?,
          closing_fee = ?,
          outputs = ?
        WHERE channels.id = ?
      `;
      await DB.query<ResultSetHeader>(query, [
        channelInfo.node1_closing_balance || 0,
        channelInfo.node2_closing_balance || 0,
        channelInfo.closed_by,
        channelInfo.closing_fee || 0,
        JSON.stringify(channelInfo.outputs),
        channelInfo.id,
      ]);
    } catch (e) {
      logger.err('$updateClosingInfo error: ' + (e instanceof Error ? e.message : e));
      // don't throw - this data isn't essential
    }
  }

  public async $updateOpeningInfo(channelInfo: { id: string, node1_funding_balance: number, node2_funding_balance: number, funding_ratio: number, single_funded: boolean | void }): Promise<void> {
    try {
      const query = `
        UPDATE channels SET
          node1_funding_balance = ?,
          node2_funding_balance = ?,
          funding_ratio = ?,
          single_funded = ?
        WHERE channels.id = ?
      `;
      await DB.query<ResultSetHeader>(query, [
        channelInfo.node1_funding_balance || 0,
        channelInfo.node2_funding_balance || 0,
        channelInfo.funding_ratio,
        channelInfo.single_funded ? 1 : 0,
        channelInfo.id,
      ]);
    } catch (e) {
      logger.err('$updateOpeningInfo error: ' + (e instanceof Error ? e.message : e));
      // don't throw - this data isn't essential
    }
  }

  public async $markChannelSourceChecked(id: string): Promise<void> {
    try {
      const query = `
        UPDATE channels
        SET source_checked = 1
        WHERE id = ?
      `;
      await DB.query<ResultSetHeader>(query, [id]);
    } catch (e) {
      logger.err('$markChannelSourceChecked error: ' + (e instanceof Error ? e.message : e));
      // don't throw - this data isn't essential
    }
  }

  public async $getChannelsForNode(public_key: string, index: number, length: number, status: string): Promise<any[]> {
    try {
      let channelStatusFilter;
      if (status === 'open') {
        channelStatusFilter = '< 2';
      } else if (status === 'active') {
        channelStatusFilter = '= 1';
      } else if (status === 'closed') {
        channelStatusFilter = '= 2';
      } else {
        throw new Error('getChannelsForNode: Invalid status requested');
      }

      // Channels originating from node
      let query = `
        SELECT COALESCE(node2.alias, SUBSTRING(node2_public_key, 0, 20)) AS alias, COALESCE(node2.public_key, node2_public_key) AS public_key,
          channels.status, channels.node1_fee_rate,
          channels.capacity, channels.short_id, channels.id, channels.closing_reason,
          UNIX_TIMESTAMP(closing_date) as closing_date, UNIX_TIMESTAMP(channels.updated_at) as updated_at
        FROM channels
        LEFT JOIN nodes AS node2 ON node2.public_key = channels.node2_public_key
        WHERE node1_public_key = ? AND channels.status ${channelStatusFilter}
      `;
      const [channelsFromNode]: any = await DB.query(query, [public_key]);

      // Channels incoming to node
      query = `
        SELECT COALESCE(node1.alias, SUBSTRING(node1_public_key, 0, 20)) AS alias, COALESCE(node1.public_key, node1_public_key) AS public_key,
          channels.status, channels.node2_fee_rate,
          channels.capacity, channels.short_id, channels.id, channels.closing_reason,
          UNIX_TIMESTAMP(closing_date) as closing_date, UNIX_TIMESTAMP(channels.updated_at) as updated_at
        FROM channels
        LEFT JOIN nodes AS node1 ON node1.public_key = channels.node1_public_key
        WHERE node2_public_key = ? AND channels.status ${channelStatusFilter}
      `;
      const [channelsToNode]: any = await DB.query(query, [public_key]);

      let allChannels = channelsFromNode.concat(channelsToNode);
      allChannels.sort((a, b) => {
        if (status === 'closed') {
          if (!b.closing_date && !a.closing_date) {
            return (b.updated_at ?? 0) - (a.updated_at ?? 0);
          } else {
            return (b.closing_date ?? 0) - (a.closing_date ?? 0);
          }
        } else {
          return b.capacity - a.capacity;
        }
      });

      if (index >= 0) {
        allChannels = allChannels.slice(index, index + length);
      } else if (index === -1) { // Node channels tree chart
        allChannels = allChannels.slice(0, 1000);
      }

      const channels: any[] = []
      for (const row of allChannels) {
        let channel;
        if (index >= 0) {
          const activeChannelsStats: any = await nodesApi.$getActiveChannelsStats(row.public_key);
          channel = {
            status: row.status,
            closing_reason: row.closing_reason,
            closing_date: row.closing_date,
            capacity: row.capacity ?? 0,
            short_id: row.short_id,
            id: row.id,
            fee_rate: row.node1_fee_rate ?? row.node2_fee_rate ?? 0,
            node: {
              alias: row.alias.length > 0 ? row.alias : row.public_key.slice(0, 20),
              public_key: row.public_key,
              channels: activeChannelsStats.active_channel_count ?? 0,
              capacity: activeChannelsStats.capacity ?? 0,
            }
          };
        } else if (index === -1) {
          channel = {
            capacity: row.capacity ?? 0,
            short_id: row.short_id,
            id: row.id,
            node: {
              alias: row.alias.length > 0 ? row.alias : row.public_key.slice(0, 20),
              public_key: row.public_key,
            }
          };
        }

        channels.push(channel);
      }

      return channels;
    } catch (e) {
      logger.err('$getChannelsForNode error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsCountForNode(public_key: string, status: string): Promise<any> {
    try {
      // Default active and inactive channels
      let statusQuery = '< 2';
      // Closed channels only
      if (status === 'closed') {
        statusQuery = '= 2';
      }
      const query = `
        SELECT COUNT(*) AS count
        FROM channels
        WHERE (node1_public_key = ? OR node2_public_key = ?)
        AND status ${statusQuery}
      `;
      const [rows]: any = await DB.query(query, [public_key, public_key]);
      return rows[0]['count'];
    } catch (e) {
      logger.err('$getChannelsForNode error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private convertChannel(channel: any): any {
    return {
      'id': channel.id,
      'short_id': channel.short_id,
      'capacity': channel.capacity,
      'transaction_id': channel.transaction_id,
      'transaction_vout': channel.transaction_vout,
      'closing_transaction_id': channel.closing_transaction_id,
      'closing_fee': channel.closing_fee,
      'closing_reason': channel.closing_reason,
      'closing_date': channel.closing_date,
      'updated_at': channel.updated_at,
      'created': channel.created,
      'status': channel.status,
      'funding_ratio': channel.funding_ratio,
      'closed_by': channel.closed_by,
      'single_funded': !!channel.single_funded,
      'node_left': {
        'alias': channel.alias_left,
        'public_key': channel.node1_public_key,
        'channels': channel.channels_left,
        'capacity': channel.capacity_left,
        'base_fee_mtokens': channel.node1_base_fee_mtokens,
        'cltv_delta': channel.node1_cltv_delta,
        'fee_rate': channel.node1_fee_rate,
        'is_disabled': channel.node1_is_disabled,
        'max_htlc_mtokens': channel.node1_max_htlc_mtokens,
        'min_htlc_mtokens': channel.node1_min_htlc_mtokens,
        'updated_at': channel.node1_updated_at,
        'longitude': channel.node1_longitude,
        'latitude': channel.node1_latitude,
        'funding_balance': channel.node1_funding_balance,
        'closing_balance': channel.node1_closing_balance,
        'initiated_close': channel.closed_by === channel.node1_public_key ? true : undefined,
      },
      'node_right': {
        'alias': channel.alias_right,
        'public_key': channel.node2_public_key,
        'channels': channel.channels_right,
        'capacity': channel.capacity_right,
        'base_fee_mtokens': channel.node2_base_fee_mtokens,
        'cltv_delta': channel.node2_cltv_delta,
        'fee_rate': channel.node2_fee_rate,
        'is_disabled': channel.node2_is_disabled,
        'max_htlc_mtokens': channel.node2_max_htlc_mtokens,
        'min_htlc_mtokens': channel.node2_min_htlc_mtokens,
        'updated_at': channel.node2_updated_at,
        'longitude': channel.node2_longitude,
        'latitude': channel.node2_latitude,
        'funding_balance': channel.node2_funding_balance,
        'closing_balance': channel.node2_closing_balance,
        'initiated_close': channel.closed_by === channel.node2_public_key ? true : undefined,
      },
    };
  }

  /**
   * Save or update a channel present in the graph
   */
  public async $saveChannel(channel: ILightningApi.Channel, status = 1): Promise<void> {
    const [ txid, vout ] = channel.chan_point.split(':');

    const policy1: Partial<ILightningApi.RoutingPolicy> = channel.node1_policy || {};
    const policy2: Partial<ILightningApi.RoutingPolicy> = channel.node2_policy || {};

    // https://github.com/mempool/mempool/issues/3006
    if ((channel.last_update ?? 0) < 1514736061) { // January 1st 2018
      channel.last_update = null;
    }
    if ((policy1.last_update ?? 0) < 1514736061) { // January 1st 2018
      policy1.last_update = null;
    }
    if ((policy2.last_update ?? 0) < 1514736061) { // January 1st 2018
      policy2.last_update = null;
    }

    const query = `INSERT INTO channels
      (
        id,
        short_id,
        capacity,
        transaction_id,
        transaction_vout,
        updated_at,
        status,
        node1_public_key,
        node1_base_fee_mtokens,
        node1_cltv_delta,
        node1_fee_rate,
        node1_is_disabled,
        node1_max_htlc_mtokens,
        node1_min_htlc_mtokens,
        node1_updated_at,
        node2_public_key,
        node2_base_fee_mtokens,
        node2_cltv_delta,
        node2_fee_rate,
        node2_is_disabled,
        node2_max_htlc_mtokens,
        node2_min_htlc_mtokens,
        node2_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ${status}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        capacity = ?,
        updated_at = ?,
        status = ${status},
        node1_public_key = ?,
        node1_base_fee_mtokens = ?,
        node1_cltv_delta = ?,
        node1_fee_rate = ?,
        node1_is_disabled = ?,
        node1_max_htlc_mtokens = ?,
        node1_min_htlc_mtokens = ?,
        node1_updated_at = ?,
        node2_public_key = ?,
        node2_base_fee_mtokens = ?,
        node2_cltv_delta = ?,
        node2_fee_rate = ?,
        node2_is_disabled = ?,
        node2_max_htlc_mtokens = ?,
        node2_min_htlc_mtokens = ?,
        node2_updated_at = ?
      ;`;

    await DB.query(query, [
      Common.channelShortIdToIntegerId(channel.channel_id),
      Common.channelIntegerIdToShortId(channel.channel_id),
      channel.capacity,
      txid,
      vout,
      Common.utcDateToMysql(channel.last_update),
      channel.node1_pub,
      policy1.fee_base_msat,
      policy1.time_lock_delta,
      policy1.fee_rate_milli_msat,
      policy1.disabled,
      policy1.max_htlc_msat,
      policy1.min_htlc,
      Common.utcDateToMysql(policy1.last_update),
      channel.node2_pub,
      policy2.fee_base_msat,
      policy2.time_lock_delta,
      policy2.fee_rate_milli_msat,
      policy2.disabled,
      policy2.max_htlc_msat,
      policy2.min_htlc,
      Common.utcDateToMysql(policy2.last_update),
      channel.capacity,
      Common.utcDateToMysql(channel.last_update),
      channel.node1_pub,
      policy1.fee_base_msat,
      policy1.time_lock_delta,
      policy1.fee_rate_milli_msat,
      policy1.disabled,
      policy1.max_htlc_msat,
      policy1.min_htlc,
      Common.utcDateToMysql(policy1.last_update),
      channel.node2_pub,
      policy2.fee_base_msat,
      policy2.time_lock_delta,
      policy2.fee_rate_milli_msat,
      policy2.disabled,
      policy2.max_htlc_msat,
      policy2.min_htlc,
      Common.utcDateToMysql(policy2.last_update)
    ]);
  }

  /**
   * Set all channels not in `graphChannelsIds` as inactive (status = 0)
   */
  public async $setChannelsInactive(graphChannelsIds: string[]): Promise<void> {
    if (graphChannelsIds.length === 0) {
      return;
    }

    try {
      const result = await DB.query<ResultSetHeader>(`
        UPDATE channels
        SET status = 0
        WHERE id NOT IN (
          ${graphChannelsIds.map(id => `"${id}"`).join(',')}
        )
        AND status != 2
      `);
      if (result[0].changedRows ?? 0 > 0) {
        logger.debug(`Marked ${result[0].changedRows} channels as inactive because they are not in the graph`, logger.tags.ln);
      }
    } catch (e) {
      logger.err('$setChannelsInactive() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  public async $getLatestChannelUpdateForNode(publicKey: string): Promise<number> {
    try {
      const query = `
        SELECT MAX(UNIX_TIMESTAMP(updated_at)) as updated_at
        FROM channels
        WHERE node1_public_key = ?
      `;
      const [rows]: any[] = await DB.query(query, [publicKey]);
      if (rows.length > 0) {
        return rows[0].updated_at;
      }
    } catch (e) {
      logger.err(`Can't getLatestChannelUpdateForNode for ${publicKey}. Reason ${e instanceof Error ? e.message : e}`);
    }
    return 0;
  }
}

export default new ChannelsApi();
