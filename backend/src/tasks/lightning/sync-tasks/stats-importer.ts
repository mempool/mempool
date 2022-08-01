import DB from '../../../database';
import { readdirSync, readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import logger from '../../../logger';
import fundingTxFetcher from './funding-tx-fetcher';
import config from '../../../config';

interface Node {
  id: string;
  timestamp: number;
  features: string;
  rgb_color: string;
  alias: string;
  addresses: string;
  out_degree: number;
  in_degree: number;
}

interface Channel {
  scid: string;
  source: string;
  destination: string;
  timestamp: number;
  features: string;
  fee_base_msat: number;
  fee_proportional_millionths: number;
  htlc_minimim_msat: number;
  cltv_expiry_delta: number;
  htlc_maximum_msat: number;
}

class LightningStatsImporter {
  topologiesFolder = config.LIGHTNING.TOPOLOGY_FOLDER;
  parser = new XMLParser();

  latestNodeCount = 1; // Ignore gap in the data

  async $run(): Promise<void> {
    logger.info(`Importing historical lightning stats`);

    // const [channels]: any[] = await DB.query('SELECT short_id from channels;');
    // logger.info('Caching funding txs for currently existing channels');
    // await fundingTxFetcher.$fetchChannelsFundingTxs(channels.map(channel => channel.short_id));
    
    await this.$importHistoricalLightningStats();
  }

  /**
   * Parse the file content into XML, and return a list of nodes and channels
   */
  parseFile(fileContent): any {
    const graph = this.parser.parse(fileContent);
    if (Object.keys(graph).length === 0) {
      return null;
    }

    const nodes: Node[] = [];
    const channels: Channel[] = [];

    // If there is only one entry, the parser does not return an array, so we override this
    if (!Array.isArray(graph.graphml.graph.node)) {
      graph.graphml.graph.node = [graph.graphml.graph.node];
    }
    if (!Array.isArray(graph.graphml.graph.edge)) {
      graph.graphml.graph.edge = [graph.graphml.graph.edge];
    }

    for (const node of graph.graphml.graph.node) {
      if (!node.data) {
        continue;
      }
      nodes.push({
        id: node.data[0],
        timestamp: node.data[1],
        features: node.data[2],
        rgb_color: node.data[3],
        alias: node.data[4],
        addresses: node.data[5],
        out_degree: node.data[6],
        in_degree: node.data[7],
      });
    }

    for (const channel of graph.graphml.graph.edge) {
      if (!channel.data) {
        continue;
      }
      channels.push({
        scid: channel.data[0],
        source: channel.data[1],
        destination: channel.data[2],
        timestamp: channel.data[3],
        features: channel.data[4],
        fee_base_msat: channel.data[5],
        fee_proportional_millionths: channel.data[6],
        htlc_minimim_msat: channel.data[7],
        cltv_expiry_delta: channel.data[8],
        htlc_maximum_msat: channel.data[9],
      });
    }

    return {
      nodes: nodes,
      channels: channels,
    };
  }

  /**
   * Generate LN network stats for one day
   */
  public async computeNetworkStats(timestamp: number, networkGraph): Promise<void> {
    // Node counts and network shares
    let clearnetNodes = 0;
    let torNodes = 0;
    let clearnetTorNodes = 0;
    let unannouncedNodes = 0;

    for (const node of networkGraph.nodes) {
      let hasOnion = false;
      let hasClearnet = false;
      let isUnnanounced = true;

      const sockets = node.addresses.split(',');
      for (const socket of sockets) {
        hasOnion = hasOnion || (socket.indexOf('torv3://') !== -1);
        hasClearnet = hasClearnet || (socket.indexOf('ipv4://') !== -1 || socket.indexOf('ipv6://') !== -1);
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
    for (const channel of networkGraph.channels) {
      const tx = await fundingTxFetcher.$fetchChannelOpenTx(channel.scid.slice(0, -2));
      if (!tx) {
        logger.err(`Unable to fetch funding tx for channel ${channel.scid}. Capacity and creation date will stay unknown.`);
        continue;
      }

      if (!nodeStats[channel.source]) {
        nodeStats[channel.source] = {
          capacity: 0,
          channels: 0,
        };
      }
      if (!nodeStats[channel.destination]) {
        nodeStats[channel.destination] = {
          capacity: 0,
          channels: 0,
        };
      }
      
      nodeStats[channel.source].capacity += Math.round(tx.value * 100000000);
      nodeStats[channel.source].channels++;
      nodeStats[channel.destination].capacity += Math.round(tx.value * 100000000);
      nodeStats[channel.destination].channels++;

      capacity += Math.round(tx.value * 100000000);
      avgFeeRate += channel.fee_proportional_millionths;
      avgBaseFee += channel.fee_base_msat;
      capacities.push(Math.round(tx.value * 100000000));
      feeRates.push(channel.fee_proportional_millionths);
      baseFees.push(channel.fee_base_msat);
    }
    
    avgFeeRate /= networkGraph.channels.length;
    avgBaseFee /= networkGraph.channels.length;
    const medCapacity = capacities.sort((a, b) => b - a)[Math.round(capacities.length / 2 - 1)];
    const medFeeRate = feeRates.sort((a, b) => b - a)[Math.round(feeRates.length / 2 - 1)];
    const medBaseFee = baseFees.sort((a, b) => b - a)[Math.round(baseFees.length / 2 - 1)];
    
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
    VALUES (FROM_UNIXTIME(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await DB.query(query, [
      timestamp,
      networkGraph.channels.length,
      networkGraph.nodes.length,
      capacity,
      torNodes,
      clearnetNodes,
      unannouncedNodes,
      clearnetTorNodes,
      Math.round(capacity / networkGraph.channels.length),
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
      VALUES (?, FROM_UNIXTIME(?), ?, ?)`;
    
      await DB.query(query, [
        public_key,
        timestamp,
        nodeStats[public_key].capacity,
        nodeStats[public_key].channels,
      ]);
    }
  }

  async $importHistoricalLightningStats(): Promise<void> {
    const fileList = readdirSync(this.topologiesFolder);
    fileList.sort().reverse();

    const [rows]: any[] = await DB.query('SELECT UNIX_TIMESTAMP(added) as added FROM lightning_stats');
    const existingStatsTimestamps = {};
    for (const row of rows) {
      existingStatsTimestamps[row.added] = true;
    }

    for (const filename of fileList) {
      const timestamp = parseInt(filename.split('_')[1], 10);
      const fileContent = readFileSync(`${this.topologiesFolder}/${filename}`, 'utf8');

      const graph = this.parseFile(fileContent);
      if (!graph) {
        continue;
      }

      // Ignore drop of more than 90% of the node count as it's probably a missing data point
      const diffRatio = graph.nodes.length / this.latestNodeCount;
      if (diffRatio < 0.90) {
        continue;
      }
      this.latestNodeCount = graph.nodes.length;

      // Stats exist already, don't calculate/insert them
      if (existingStatsTimestamps[timestamp] === true) {
        continue;
      }

      logger.debug(`Processing ${this.topologiesFolder}/${filename}`);

      const datestr = `${new Date(timestamp * 1000).toUTCString()} (${timestamp})`;
      logger.debug(`${datestr}: Found ${graph.nodes.length} nodes and ${graph.channels.length} channels`);

      // Cache funding txs
      logger.debug(`Caching funding txs for ${datestr}`);
      await fundingTxFetcher.$fetchChannelsFundingTxs(graph.channels.map(channel => channel.scid.slice(0, -2)));

      logger.debug(`Generating LN network stats for ${datestr}`);
      await this.computeNetworkStats(timestamp, graph);
    }

    logger.info(`Lightning network stats historical import completed`);
  }
}

export default new LightningStatsImporter;