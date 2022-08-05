import DB from '../../../database';
import { promises } from 'fs';
import logger from '../../../logger';
import fundingTxFetcher from './funding-tx-fetcher';
import config from '../../../config';

const fsPromises = promises;

class LightningStatsImporter {
  topologiesFolder = config.LIGHTNING.TOPOLOGY_FOLDER;

  async $run(): Promise<void> {
    logger.info(`Importing historical lightning stats`);

    const [channels]: any[] = await DB.query('SELECT short_id from channels;');
    logger.info('Caching funding txs for currently existing channels');
    await fundingTxFetcher.$fetchChannelsFundingTxs(channels.map(channel => channel.short_id));

    await this.$importHistoricalLightningStats();
  }

  /**
   * Generate LN network stats for one day
   */
  public async computeNetworkStats(timestamp: number, networkGraph): Promise<unknown> {
    // Node counts and network shares
    let clearnetNodes = 0;
    let torNodes = 0;
    let clearnetTorNodes = 0;
    let unannouncedNodes = 0;

    for (const node of networkGraph.nodes) {
      let hasOnion = false;
      let hasClearnet = false;
      let isUnnanounced = true;

      for (const socket of (node.addresses ?? [])) {
        hasOnion = hasOnion || ['torv2', 'torv3'].includes(socket.network);
        hasClearnet = hasClearnet || ['ipv4', 'ipv6'].includes(socket.network);
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
    
    for (const channel of networkGraph.edges) {
      let short_id = channel.channel_id;
      if (short_id.indexOf('/') !== -1) {
        short_id = short_id.slice(0, -2);
      }

      const tx = await fundingTxFetcher.$fetchChannelOpenTx(short_id);
      if (!tx) {
        logger.err(`Unable to fetch funding tx for channel ${short_id}. Capacity and creation date is unknown. Skipping channel.`);
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

      if (channel.node1_policy !== undefined) { // Coming from the node
        for (const policy of [channel.node1_policy, channel.node2_policy]) {
          if (policy && policy.fee_rate_milli_msat < 5000) {
            avgFeeRate += policy.fee_rate_milli_msat;
            feeRates.push(policy.fee_rate_milli_msat);
          }  
          if (policy && policy.fee_base_msat < 5000) {
            avgBaseFee += policy.fee_base_msat;      
            baseFees.push(policy.fee_base_msat);
          }
        }
      } else { // Coming from the historical import
        if (channel.fee_rate_milli_msat < 5000) {
          avgFeeRate += channel.fee_rate_milli_msat;
          feeRates.push(channel.fee_rate_milli_msat);
        }  
        if (channel.fee_base_msat < 5000) {
          avgBaseFee += channel.fee_base_msat;      
          baseFees.push(channel.fee_base_msat);
        }
      }
    }
    
    avgFeeRate /= networkGraph.edges.length;
    avgBaseFee /= networkGraph.edges.length;
    const medCapacity = capacities.sort((a, b) => b - a)[Math.round(capacities.length / 2 - 1)];
    const medFeeRate = feeRates.sort((a, b) => b - a)[Math.round(feeRates.length / 2 - 1)];
    const medBaseFee = baseFees.sort((a, b) => b - a)[Math.round(baseFees.length / 2 - 1)];
    const avgCapacity = Math.round(capacity / capacities.length);

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
    }

    return {
      added: timestamp,
      node_count: networkGraph.nodes.length
    };
  }

  async $importHistoricalLightningStats(): Promise<void> {
    let latestNodeCount = 1;

    const fileList = await fsPromises.readdir(this.topologiesFolder);
    // Insert history from the most recent to the oldest
    // This also put the .json cached files first
    fileList.sort().reverse();

    const [rows]: any[] = await DB.query(`
      SELECT UNIX_TIMESTAMP(added) AS added, node_count
      FROM lightning_stats
      ORDER BY added DESC
    `);
    const existingStatsTimestamps = {};
    for (const row of rows) {
      existingStatsTimestamps[row.added] = row;
    }

    // For logging purpose
    let processed = 10;
    let totalProcessed = -1;

    for (const filename of fileList) {
      processed++;
      totalProcessed++;

      const timestamp = parseInt(filename.split('_')[1], 10);

      // Stats exist already, don't calculate/insert them
      if (existingStatsTimestamps[timestamp] !== undefined) {
        latestNodeCount = existingStatsTimestamps[timestamp].node_count;
        continue;
      }

      logger.debug(`Reading ${this.topologiesFolder}/${filename}`);
      const fileContent = await fsPromises.readFile(`${this.topologiesFolder}/${filename}`, 'utf8');

      let graph;
      if (filename.indexOf('.topology') !== -1) {
        try {
          graph = JSON.parse(fileContent);
        } catch (e) {
          logger.debug(`Invalid topology file ${this.topologiesFolder}/${filename}, cannot parse the content`);
          continue;
        }
      }

      if (timestamp > 1556316000) {
        // "No, the reason most likely is just that I started collection in 2019,
        // so what I had before that is just the survivors from before, which weren't that many"
        const diffRatio = graph.nodes.length / latestNodeCount;
        if (diffRatio < 0.9) {
          // Ignore drop of more than 90% of the node count as it's probably a missing data point
          logger.debug(`Nodes count diff ratio threshold reached, ignore the data for this day ${graph.nodes.length} nodes vs ${latestNodeCount}`);
          continue;
        }
      }
      latestNodeCount = graph.nodes.length;

      const datestr = `${new Date(timestamp * 1000).toUTCString()} (${timestamp})`;
      logger.debug(`${datestr}: Found ${graph.nodes.length} nodes and ${graph.edges.length} channels`);

      if (processed > 10) {
        logger.info(`Generating LN network stats for ${datestr}. Processed ${totalProcessed}/${fileList.length} files`);
        processed = 0;
      } else {
        logger.debug(`Generating LN network stats for ${datestr}. Processed ${totalProcessed}/${fileList.length} files`);
      }
      await fundingTxFetcher.$fetchChannelsFundingTxs(graph.edges.map(channel => channel.channel_id.slice(0, -2)));
      const stat = await this.computeNetworkStats(timestamp, graph);

      existingStatsTimestamps[timestamp] = stat;
    }

    logger.info(`Lightning network stats historical import completed`);
  }
}

export default new LightningStatsImporter;
