import DB from '../../../database';
import { promises } from 'fs';
import logger from '../../../logger';
import fundingTxFetcher from './funding-tx-fetcher';
import config from '../../../config';
import { ILightningApi } from '../../../api/lightning/lightning-api.interface';
import { isIP } from 'net';
import { Common } from '../../../api/common';
import channelsApi from '../../../api/explorer/channels.api';
import nodesApi from '../../../api/explorer/nodes.api';

const fsPromises = promises;

class LightningStatsImporter {
  topologiesFolder = config.LIGHTNING.TOPOLOGY_FOLDER;

  async $run(): Promise<void> {
    try {
      const [channels]: any[] = await DB.query('SELECT short_id from channels;');
      logger.info(`Caching funding txs for currently existing channels`, logger.tags.ln);
      await fundingTxFetcher.$fetchChannelsFundingTxs(channels.map(channel => channel.short_id));

      if (config.MEMPOOL.NETWORK !== 'mainnet' || config.DATABASE.ENABLED === false) {
        return;
      }

      await this.$importHistoricalLightningStats();
      await this.$cleanupIncorrectSnapshot();
    } catch (e) {
      logger.err(`Exception in LightningStatsImporter::$run(). ${e}`);
    }
  }

  /**
   * Generate LN network stats for one day
   */
  public async computeNetworkStats(timestamp: number,
    networkGraph: ILightningApi.NetworkGraph, isHistorical: boolean = false): Promise<unknown> {
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
      // If we don't know about this node, insert it in db
      if (isHistorical === true && !nodesInDb[node.pub_key]) {
        await nodesApi.$saveNode({
          last_update: node.last_update,
          pub_key: node.pub_key,
          alias: node.alias,
          addresses: node.addresses,
          color: node.color,
          features: node.features,
        });
        nodesInDb[node.pub_key] = node;
      } else {
        await nodesApi.$updateNodeSockets(node.pub_key, node.addresses);
      }

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

      const tx = await fundingTxFetcher.$fetchChannelOpenTx(short_id);
      if (!tx) {
        logger.err(`Unable to fetch funding tx for channel ${short_id}. Capacity and creation date is unknown. Skipping channel.`, logger.tags.ln);
        continue;
      }

      // If we don't know about this channel, insert it in db
      if (isHistorical === true && !channelsInDb[short_id]) {
        await channelsApi.$saveChannel({
          channel_id: short_id,
          chan_point: `${tx.txid}:${short_id.split('x')[2]}`,
          last_update: channel.last_update,
          node1_pub: channel.node1_pub,
          node2_pub: channel.node2_pub,
          capacity: (tx.value * 100000000).toString(),
          node1_policy: null,
          node2_policy: null,
        }, 0);
        channelsInDb[channel.channel_id] = channel;
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

      if (isHistorical === false) { // Coming from the node
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
      } else {
        // @ts-ignore
        if (channel.node1_policy.fee_rate_milli_msat < 5000) {
          // @ts-ignore
          avgFeeRate += parseInt(channel.node1_policy.fee_rate_milli_msat, 10);
          // @ts-ignore
          feeRates.push(parseInt(channel.node1_policy.fee_rate_milli_msat), 10);
        }
        // @ts-ignore
        if (channel.node1_policy.fee_base_msat < 5000) {
          // @ts-ignore
          avgBaseFee += parseInt(channel.node1_policy.fee_base_msat, 10);
          // @ts-ignore
          baseFees.push(parseInt(channel.node1_policy.fee_base_msat), 10);
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

      if (!isHistorical) {
        await DB.query(
          `UPDATE nodes SET capacity = ?, channels = ? WHERE public_key = ?`,
          [
            nodeStats[public_key].capacity,
            nodeStats[public_key].channels,
            public_key,
          ]
        );
      }
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
    if (!config.LIGHTNING.TOPOLOGY_FOLDER) {
      logger.info(`Lightning topology folder is not set. Not importing historical LN stats`);
      return;
    }

    logger.debug('Run the historical importer');
    try {
      let fileList: string[] = [];
      try {
        fileList = await fsPromises.readdir(this.topologiesFolder);
      } catch (e) {
        logger.err(`Unable to open topology folder at ${this.topologiesFolder}`, logger.tags.ln);
        throw e;
      }
      // Insert history from the most recent to the oldest
      // This also put the .json cached files first
      fileList.sort().reverse();

      const [rows]: any[] = await DB.query(`
        SELECT UNIX_TIMESTAMP(added) AS added
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
          totalProcessed++;
          continue;
        }

        if (filename.indexOf('topology_') === -1) {
          totalProcessed++;
          continue;
        }

        logger.debug(`Reading ${this.topologiesFolder}/${filename}`, logger.tags.ln);
        let fileContent = '';
        try {
          fileContent = await fsPromises.readFile(`${this.topologiesFolder}/${filename}`, 'utf8');
        } catch (e: any) {
          if (e.errno == -1) { // EISDIR - Ignore directorie
            totalProcessed++;
            continue;
          }
          logger.err(`Unable to open ${this.topologiesFolder}/${filename}`, logger.tags.ln);
          totalProcessed++;
          continue;
        }

        let graph;
        try {
          graph = JSON.parse(fileContent);
          graph = await this.cleanupTopology(graph);
        } catch (e) {
          logger.debug(`Invalid topology file ${this.topologiesFolder}/${filename}, cannot parse the content. Reason: ${e instanceof Error ? e.message : e}`, logger.tags.ln);
          totalProcessed++;
          continue;
        }
    
        if (this.isIncorrectSnapshot(timestamp, graph)) {
          logger.debug(`Ignoring ${this.topologiesFolder}/${filename}, because we defined it as an incorrect snapshot`);
          ++totalProcessed;
          continue;
        }

        if (!logStarted) {
          logger.info(`Founds a topology file that we did not import. Importing historical lightning stats now.`, logger.tags.ln);
          logStarted = true;
        }
        
        const datestr = `${new Date(timestamp * 1000).toUTCString()} (${timestamp})`;
        logger.debug(`${datestr}: Found ${graph.nodes.length} nodes and ${graph.edges.length} channels`, logger.tags.ln);

        totalProcessed++;

        if (processed > 10) {
          logger.info(`Generating LN network stats for ${datestr}. Processed ${totalProcessed}/${fileList.length} files`, logger.tags.ln);
          processed = 0;
        } else {
          logger.debug(`Generating LN network stats for ${datestr}. Processed ${totalProcessed}/${fileList.length} files`, logger.tags.ln);
        }
        await fundingTxFetcher.$fetchChannelsFundingTxs(graph.edges.map(channel => channel.channel_id.slice(0, -2)));
        const stat = await this.computeNetworkStats(timestamp, graph, true);

        existingStatsTimestamps[timestamp] = stat;
      }

      if (totalProcessed > 0) {
        logger.info(`Lightning network stats historical import completed`, logger.tags.ln);
      }
    } catch (e) {
      logger.err(`Lightning network stats historical failed. Reason: ${e instanceof Error ? e.message : e}`, logger.tags.ln);
    }
  }

  cleanupTopology(graph): ILightningApi.NetworkGraph {
    const newGraph = {
      nodes: <ILightningApi.Node[]>[],
      edges: <ILightningApi.Channel[]>[],
    };

    for (const node of graph.nodes) {
      const addressesParts = (node.addresses ?? '').split(',');
      const addresses: any[] = [];
      for (const address of addressesParts) {
        const formatted = Common.findSocketNetwork(address);
        addresses.push({
          network: formatted.network,
          addr: formatted.url
        });
      }

      let rgb = node.rgb_color ?? '#000000';
      if (rgb.indexOf('#') === -1) {
        rgb = `#${rgb}`;
      }
      newGraph.nodes.push({
        last_update: node.timestamp ?? 0,
        pub_key: node.id ?? null,
        alias: node.alias ?? node.id.slice(0, 20),
        addresses: addresses,
        color: rgb,
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

  private isIncorrectSnapshot(timestamp, graph): boolean {
    if (timestamp >= 1549065600 /* 2019-02-02 */ && timestamp <= 1550620800 /* 2019-02-20 */ && graph.nodes.length < 2600) {
        return true;
    }
    if (timestamp >= 1552953600 /* 2019-03-19 */ && timestamp <= 1556323200 /* 2019-05-27 */ && graph.nodes.length < 4000) {
      return true;
    }
    if (timestamp >= 1557446400 /* 2019-05-10 */ && timestamp <= 1560470400 /* 2019-06-14 */ && graph.nodes.length < 4000) {
      return true;
    }
    if (timestamp >= 1561680000 /* 2019-06-28 */ && timestamp <= 1563148800 /* 2019-07-15 */ && graph.nodes.length < 4000) {
      return true;
    }
    if (timestamp >= 1571270400 /* 2019-11-17 */ && timestamp <= 1580601600 /* 2020-02-02 */ && graph.nodes.length < 4500) {
      return true;
    }
    if (timestamp >= 1591142400 /* 2020-06-03 */ && timestamp <= 1592006400 /* 2020-06-13 */ && graph.nodes.length < 5500) {
      return true;
    }
    if (timestamp >= 1632787200 /* 2021-09-28 */ && timestamp <= 1633564800 /* 2021-10-07 */ && graph.nodes.length < 13000) {
      return true;
    }
    if (timestamp >= 1634256000 /* 2021-10-15 */ && timestamp <= 1645401600 /* 2022-02-21 */ && graph.nodes.length < 17000) {
      return true;
    }
    if (timestamp >= 1654992000 /* 2022-06-12 */ && timestamp <= 1661472000 /* 2022-08-26 */ && graph.nodes.length < 14000) {
      return true;
    }

    return false;
  }

  private async $cleanupIncorrectSnapshot(): Promise<void> {
    // We do not run this one automatically because those stats are not supposed to be inserted in the first
    // place, but I write them here to remind us we manually run those queries

    // DELETE FROM lightning_stats
    // WHERE (
    //   UNIX_TIMESTAMP(added) >= 1549065600 AND UNIX_TIMESTAMP(added) <= 1550620800 AND node_count < 2600 OR
    //   UNIX_TIMESTAMP(added) >= 1552953600 AND UNIX_TIMESTAMP(added) <= 1556323200 AND node_count < 4000 OR
    //   UNIX_TIMESTAMP(added) >= 1557446400 AND UNIX_TIMESTAMP(added) <= 1560470400 AND node_count < 4000 OR
    //   UNIX_TIMESTAMP(added) >= 1561680000 AND UNIX_TIMESTAMP(added) <= 1563148800 AND node_count < 4000 OR
    //   UNIX_TIMESTAMP(added) >= 1571270400 AND UNIX_TIMESTAMP(added) <= 1580601600 AND node_count < 4500 OR
    //   UNIX_TIMESTAMP(added) >= 1591142400 AND UNIX_TIMESTAMP(added) <= 1592006400 AND node_count < 5500 OR
    //   UNIX_TIMESTAMP(added) >= 1632787200 AND UNIX_TIMESTAMP(added) <= 1633564800 AND node_count < 13000 OR
    //   UNIX_TIMESTAMP(added) >= 1634256000 AND UNIX_TIMESTAMP(added) <= 1645401600 AND node_count < 17000 OR
    //   UNIX_TIMESTAMP(added) >= 1654992000 AND UNIX_TIMESTAMP(added) <= 1661472000 AND node_count < 14000
    // )

    // DELETE FROM node_stats
    // WHERE (
    //   UNIX_TIMESTAMP(added) >= 1549065600 AND UNIX_TIMESTAMP(added) <= 1550620800 OR
    //   UNIX_TIMESTAMP(added) >= 1552953600 AND UNIX_TIMESTAMP(added) <= 1556323200 OR
    //   UNIX_TIMESTAMP(added) >= 1557446400 AND UNIX_TIMESTAMP(added) <= 1560470400 OR
    //   UNIX_TIMESTAMP(added) >= 1561680000 AND UNIX_TIMESTAMP(added) <= 1563148800 OR
    //   UNIX_TIMESTAMP(added) >= 1571270400 AND UNIX_TIMESTAMP(added) <= 1580601600 OR
    //   UNIX_TIMESTAMP(added) >= 1591142400 AND UNIX_TIMESTAMP(added) <= 1592006400 OR
    //   UNIX_TIMESTAMP(added) >= 1632787200 AND UNIX_TIMESTAMP(added) <= 1633564800 OR
    //   UNIX_TIMESTAMP(added) >= 1634256000 AND UNIX_TIMESTAMP(added) <= 1645401600 OR
    //   UNIX_TIMESTAMP(added) >= 1654992000 AND UNIX_TIMESTAMP(added) <= 1661472000 
    // )
  }
}

export default new LightningStatsImporter;
