import DB from '../../../database';
import { promises } from 'fs';
import logger from '../../../logger';
import fundingTxFetcher from './funding-tx-fetcher';
import config from '../../../config';
import { ILightningApi } from '../../../api/lightning/lightning-api.interface';
import { isIP } from 'net';

const fsPromises = promises;

class LightningStatsImporter {
  topologiesFolder = config.LIGHTNING.TOPOLOGY_FOLDER;

  async $run(): Promise<void> {
    const [channels]: any[] = await DB.query('SELECT short_id from channels;');
    logger.info('Caching funding txs for currently existing channels');
    await fundingTxFetcher.$fetchChannelsFundingTxs(channels.map(channel => channel.short_id));

    await this.$importHistoricalLightningStats();
  }

  /**
   * Generate LN network stats for one day
   */
  public async computeNetworkStats(timestamp: number, networkGraph: ILightningApi.NetworkGraph): Promise<unknown> {
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
          if (policy && parseInt(policy.fee_rate_milli_msat, 10) < 5000) {
            avgFeeRate += parseInt(policy.fee_rate_milli_msat, 10);
            feeRates.push(parseInt(policy.fee_rate_milli_msat, 10));
          }  
          if (policy && parseInt(policy.fee_base_msat, 10) < 5000) {
            avgBaseFee += parseInt(policy.fee_base_msat, 10);
            baseFees.push(parseInt(policy.fee_base_msat, 10));
          }
        }
      } else { // Coming from the historical import
        // @ts-ignore
        if (channel.fee_rate_milli_msat < 5000) {
          // @ts-ignore
          avgFeeRate += parseInt(channel.fee_rate_milli_msat, 10);
          // @ts-ignore
          feeRates.push(parseInt(channel.fee_rate_milli_msat), 10);
        }
        // @ts-ignore
        if (channel.fee_base_msat < 5000) {
          // @ts-ignore
          avgBaseFee += parseInt(channel.fee_base_msat, 10);
          // @ts-ignore
          baseFees.push(parseInt(channel.fee_base_msat), 10);
        }
      }
    }

    avgFeeRate /= Math.max(networkGraph.edges.length, 1);
    avgBaseFee /= Math.max(networkGraph.edges.length, 1);
    const medCapacity = capacities.sort((a, b) => b - a)[Math.round(capacities.length / 2 - 1)];
    const medFeeRate = feeRates.sort((a, b) => b - a)[Math.round(feeRates.length / 2 - 1)];
    const medBaseFee = baseFees.sort((a, b) => b - a)[Math.round(baseFees.length / 2 - 1)];
    const avgCapacity = Math.round(capacity / Math.max(capacities.length, 1));

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

  /**
   * Import topology files LN historical data into the database
   */
  async $importHistoricalLightningStats(): Promise<void> {
    try {
      let fileList: string[] = [];
      try {
        fileList = await fsPromises.readdir(this.topologiesFolder);
      } catch (e) {
        logger.err(`Unable to open topology folder at ${this.topologiesFolder}`);
        throw e;
      }
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
      let totalProcessed = 0;
      let logStarted = false;

      for (const filename of fileList) {
        processed++;

        const timestamp = parseInt(filename.split('_')[1], 10);

        // Stats exist already, don't calculate/insert them
        if (existingStatsTimestamps[timestamp] !== undefined) {
          continue;
        }

        if (filename.indexOf('topology_') === -1) {
          continue;
        }

        logger.debug(`Reading ${this.topologiesFolder}/${filename}`);
        let fileContent = '';
        try {
          fileContent = await fsPromises.readFile(`${this.topologiesFolder}/${filename}`, 'utf8');
        } catch (e: any) {
          if (e.errno == -1) { // EISDIR - Ignore directorie
            continue;
          }
          logger.err(`Unable to open ${this.topologiesFolder}/${filename}`);
          continue;
        }

        let graph;
        try {
          graph = JSON.parse(fileContent);
          graph = await this.cleanupTopology(graph);
        } catch (e) {
          logger.debug(`Invalid topology file ${this.topologiesFolder}/${filename}, cannot parse the content`);
          continue;
        }
    
        if (!logStarted) {
          logger.info(`Founds a topology file that we did not import. Importing historical lightning stats now.`);
          logStarted = true;
        }
        
        const datestr = `${new Date(timestamp * 1000).toUTCString()} (${timestamp})`;
        logger.debug(`${datestr}: Found ${graph.nodes.length} nodes and ${graph.edges.length} channels`);

        totalProcessed++;

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

      if (totalProcessed > 0) {
        logger.info(`Lightning network stats historical import completed`);
      }
    } catch (e) {
      logger.err(`Lightning network stats historical failed. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

  async cleanupTopology(graph) {
    const newGraph = {
      nodes: <ILightningApi.Node[]>[],
      edges: <ILightningApi.Channel[]>[],
    };

    for (const node of graph.nodes) {
      const addressesParts = (node.addresses ?? '').split(',');
      const addresses: any[] = [];
      for (const address of addressesParts) {
        addresses.push({
          network: '',
          addr: address
        });
      }

      newGraph.nodes.push({
        last_update: node.timestamp ?? 0,
        pub_key: node.id ?? null,
        alias: node.alias ?? null,
        addresses: addresses,
        color: node.rgb_color ?? null,
        features: {},
      });
    }

    for (const adjacency of graph.adjacency) {
      if (adjacency.length === 0) {
        continue;
      } else {
        for (const edge of adjacency) {
          newGraph.edges.push({
            channel_id: edge.scid,
            chan_point: '',
            last_update: edge.timestamp,
            node1_pub: edge.source ?? null,
            node2_pub: edge.destination ?? null,
            capacity: '0', // Will be fetch later
            node1_policy: {
              time_lock_delta: edge.cltv_expiry_delta,
              min_htlc: edge.htlc_minimim_msat,
              fee_base_msat: edge.fee_base_msat,
              fee_rate_milli_msat: edge.fee_proportional_millionths,
              max_htlc_msat: edge.htlc_maximum_msat,
              last_update: edge.timestamp,
              disabled: false,          
            },
            node2_policy: null,
          });
        }
      }
    }

    return newGraph;
  }
}

export default new LightningStatsImporter;
