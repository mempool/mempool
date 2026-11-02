import DB from '../../../database';
import logger from '../../../logger';
import fundingTxFetcher from './funding-tx-fetcher';
import { ILightningApi } from '../../../api/lightning/lightning-api.interface';
import { isIP } from 'net';
import { Common } from '../../../api/common';
import nodesApi from '../../../api/explorer/nodes.api';

class LightningStatsImporter {

  /** @asyncSafe */
  async $run(): Promise<void> {
    try {
      const [channels]: any[] = await DB.query('SELECT short_id from channels;');
      logger.info(`Caching funding txs for currently existing channels`, logger.tags.ln);
      await fundingTxFetcher.$fetchChannelsFundingTxs(channels.map(channel => channel.short_id));
    } catch (e) {
      logger.err(`Exception in LightningStatsImporter::$run(). ${e}`);
    }
  }

  /**
   * Generate LN network stats for one day
   * @asyncUnsafe
   */
  public async computeNetworkStats(timestamp: number,
    networkGraph: ILightningApi.NetworkGraph): Promise<unknown> {
    // Node counts and network shares
    let clearnetNodes = 0;
    let torNodes = 0;
    let clearnetTorNodes = 0;
    let unannouncedNodes = 0;

    const [nodesInDbRaw]: any[] = await DB.query(`SELECT public_key FROM nodes`);
    const nodesInDb = {};
    for (const node of nodesInDbRaw) {
      nodesInDb[node.public_key] = node;
    }

    for (const node of networkGraph.nodes) {

      await nodesApi.$updateNodeSockets(node.pub_key, node.addresses);

      let hasOnion = false;
      let hasClearnet = false;
      let isUnnanounced = true;

      for (const socket of (node.addresses ?? [])) {
        if (!socket.network?.length && !socket.addr?.length) {
          continue;
        }
        hasOnion = hasOnion || ['torv2', 'torv3'].includes(socket.network) || socket.addr.indexOf('onion') !== -1 || socket.addr.indexOf('torv2') !== -1 || socket.addr.indexOf('torv3') !== -1;
        hasClearnet = hasClearnet || ['ipv4', 'ipv6'].includes(socket.network) || [4, 6].includes(isIP(socket.addr.split(':')[0])) || socket.addr.indexOf('ipv4') !== -1 || socket.addr.indexOf('ipv6') !== -1;;
      }
      if (hasOnion && hasClearnet) {
        clearnetTorNodes++;
        isUnnanounced = false;
      } else if (hasOnion) {
        torNodes++;
        isUnnanounced = false;
      } else if (hasClearnet) {
        clearnetNodes++;
        isUnnanounced = false;
      }
      if (isUnnanounced) {
        unannouncedNodes++;
      }
    }

    // Channels and node historical stats
    const nodeStats = {};
    let capacity = 0;
    let avgFeeRate = 0;
    let avgBaseFee = 0;
    const capacities: number[] = [];
    const feeRates: number[] = [];
    const baseFees: number[] = [];
    const alreadyCountedChannels = {};

    const [channelsInDbRaw]: any[] = await DB.query(`SELECT short_id FROM channels`);
    const channelsInDb = {};
    for (const channel of channelsInDbRaw) {
      channelsInDb[channel.short_id] = channel;
    }

    for (const channel of networkGraph.edges) {
      const short_id = Common.channelIntegerIdToShortId(channel.channel_id);
      if (!short_id?.length) {
        continue;
      }

      const tx = await fundingTxFetcher.$fetchChannelOpenTx(short_id);
      if (!tx) {
        logger.err(`Unable to fetch funding tx for channel ${short_id}. Capacity and creation date is unknown. Skipping channel.`, logger.tags.ln);
        continue;
      }

      if (!nodeStats[channel.node1_pub]) {
        nodeStats[channel.node1_pub] = {
          capacity: 0,
          channels: 0,
        };
      }
      if (!nodeStats[channel.node2_pub]) {
        nodeStats[channel.node2_pub] = {
          capacity: 0,
          channels: 0,
        };
      }

      if (!alreadyCountedChannels[short_id]) {
        capacity += Math.round(tx.value * 100000000);
        capacities.push(Math.round(tx.value * 100000000));
        alreadyCountedChannels[short_id] = true;

        nodeStats[channel.node1_pub].capacity += Math.round(tx.value * 100000000);
        nodeStats[channel.node1_pub].channels++;
        nodeStats[channel.node2_pub].capacity += Math.round(tx.value * 100000000);
        nodeStats[channel.node2_pub].channels++;
      }

      for (const policy of [channel.node1_policy, channel.node2_policy]) {
        if (policy && parseInt(policy.fee_rate_milli_msat, 10) < 5000) {
          avgFeeRate += parseInt(policy.fee_rate_milli_msat, 10);
          feeRates.push(parseInt(policy.fee_rate_milli_msat, 10));
        }
        if (policy && parseInt(policy.fee_base_msat, 10) < 5000) {
          avgBaseFee += parseInt(policy.fee_base_msat, 10);
          baseFees.push(parseInt(policy.fee_base_msat, 10));
        }
      }
    }

    let medCapacity = 0;
    let medFeeRate = 0;
    let medBaseFee = 0;
    let avgCapacity = 0;

    avgFeeRate /= Math.max(networkGraph.edges.length, 1);
    avgBaseFee /= Math.max(networkGraph.edges.length, 1);

    if (capacities.length > 0) {
      medCapacity = capacities.sort((a, b) => b - a)[Math.round(capacities.length / 2 - 1)];
      avgCapacity = Math.round(capacity / Math.max(capacities.length, 1));
    }
    if (feeRates.length > 0) {
      medFeeRate = feeRates.sort((a, b) => b - a)[Math.round(feeRates.length / 2 - 1)];
    }
    if (baseFees.length > 0) {
      medBaseFee = baseFees.sort((a, b) => b - a)[Math.round(baseFees.length / 2 - 1)];
    }

    let query = `INSERT INTO lightning_stats(
        added,
        channel_count,
        node_count,
        total_capacity,
        tor_nodes,
        clearnet_nodes,
        unannounced_nodes,
        clearnet_tor_nodes,
        avg_capacity,
        avg_fee_rate,
        avg_base_fee_mtokens,
        med_capacity,
        med_fee_rate,
        med_base_fee_mtokens
      )
      VALUES (FROM_UNIXTIME(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      added = FROM_UNIXTIME(?),
      channel_count = ?,
      node_count = ?,
      total_capacity = ?,
      tor_nodes = ?,
      clearnet_nodes = ?,
      unannounced_nodes = ?,
      clearnet_tor_nodes = ?,
      avg_capacity = ?,
      avg_fee_rate = ?,
      avg_base_fee_mtokens = ?,
      med_capacity = ?,
      med_fee_rate = ?,
      med_base_fee_mtokens = ?
    `;

    await DB.query(query, [
      timestamp,
      capacities.length,
      networkGraph.nodes.length,
      capacity,
      torNodes,
      clearnetNodes,
      unannouncedNodes,
      clearnetTorNodes,
      avgCapacity,
      avgFeeRate,
      avgBaseFee,
      medCapacity,
      medFeeRate,
      medBaseFee,
      timestamp,
      capacities.length,
      networkGraph.nodes.length,
      capacity,
      torNodes,
      clearnetNodes,
      unannouncedNodes,
      clearnetTorNodes,
      avgCapacity,
      avgFeeRate,
      avgBaseFee,
      medCapacity,
      medFeeRate,
      medBaseFee,
    ]);

    for (const public_key of Object.keys(nodeStats)) {
      query = `INSERT INTO node_stats(
          public_key,
          added,
          capacity,
          channels
        )
        VALUES (?, FROM_UNIXTIME(?), ?, ?)
        ON DUPLICATE KEY UPDATE
        added = FROM_UNIXTIME(?),
        capacity = ?,
        channels = ?
      `;

      await DB.query(query, [
        public_key,
        timestamp,
        nodeStats[public_key].capacity,
        nodeStats[public_key].channels,
        timestamp,
        nodeStats[public_key].capacity,
        nodeStats[public_key].channels,
      ]);

      await DB.query(
        `UPDATE nodes SET capacity = ?, channels = ? WHERE public_key = ?`,
        [
          nodeStats[public_key].capacity,
          nodeStats[public_key].channels,
          public_key,
        ]
      );
    }

    return {
      added: timestamp,
      node_count: networkGraph.nodes.length
    };
  }
}

export default new LightningStatsImporter;
