import logger from '../../logger';
import DB from '../../database';
import { ResultSetHeader } from 'mysql2';
import { ILightningApi } from '../lightning/lightning-api.interface';
import { ITopNodesPerCapacity, ITopNodesPerChannels } from '../../mempool.interfaces';
import { bin2hex } from '../../utils/format';

class NodesApi {
  public async $getWorldNodes(): Promise<any> {
    try {
      let query = `
        SELECT nodes.public_key as publicKey, IF(nodes.alias = '', SUBSTRING(nodes.public_key, 1, 20), alias) as alias,
        CAST(COALESCE(nodes.capacity, 0) as INT) as capacity,
        CAST(COALESCE(nodes.channels, 0) as INT) as channels,
        nodes.longitude, nodes.latitude,
        geo_names_country.names as country, geo_names_iso.names as isoCode
        FROM nodes
        JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
        JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
        WHERE status = 1 AND nodes.as_number IS NOT NULL
        ORDER BY capacity
      `;

      const [nodes]: any[] = await DB.query(query);

      for (let i = 0; i < nodes.length; ++i) {
        nodes[i].country = JSON.parse(nodes[i].country);
      }

      query = `
        SELECT MAX(nodes.capacity) as maxLiquidity, MAX(nodes.channels) as maxChannels
        FROM nodes
        WHERE status = 1 AND nodes.as_number IS NOT NULL
      `;

      const [maximums]: any[] = await DB.query(query);
      
      return {
        maxLiquidity: maximums[0].maxLiquidity,
        maxChannels: maximums[0].maxChannels,
        nodes: nodes.map(node => [
          node.longitude, node.latitude,
          node.publicKey, node.alias, node.capacity, node.channels,
          node.country, node.isoCode
        ])
      };
    } catch (e) {
      logger.err(`Can't get world nodes list. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

  public async $getNode(public_key: string): Promise<any> {
    try {
      // General info
      let query = `
        SELECT public_key, alias, UNIX_TIMESTAMP(first_seen) AS first_seen,
          UNIX_TIMESTAMP(updated_at) AS updated_at, color, sockets as sockets,
          as_number, city_id, country_id, subdivision_id, longitude, latitude,
          geo_names_iso.names as iso_code, geo_names_as.names as as_organization, geo_names_city.names as city,
          geo_names_country.names as country, geo_names_subdivision.names as subdivision,
          features
        FROM nodes
        LEFT JOIN geo_names geo_names_as on geo_names_as.id = as_number
        LEFT JOIN geo_names geo_names_city on geo_names_city.id = city_id
        LEFT JOIN geo_names geo_names_subdivision on geo_names_subdivision.id = subdivision_id
        LEFT JOIN geo_names geo_names_country on geo_names_country.id = country_id
        LEFT JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
        WHERE public_key = ?
      `;
      let [rows]: any[] = await DB.query(query, [public_key]);
      if (rows.length === 0) {
        throw new Error(`This node does not exist, or our node is not seeing it yet`);
      }

      const node = rows[0];
      node.as_organization = JSON.parse(node.as_organization);
      node.subdivision = JSON.parse(node.subdivision);
      node.city = JSON.parse(node.city);
      node.country = JSON.parse(node.country);

      // Features      
      node.features = JSON.parse(node.features);
      node.featuresBits = null;
      if (node.features) {
        let maxBit = 0;
        for (const feature of node.features) {
          maxBit = Math.max(maxBit, feature.bit);
        }
        maxBit = Math.ceil(maxBit / 4) * 4 - 1;
        
        node.featuresBits = new Array(maxBit + 1).fill(0);
        for (const feature of node.features) {
          node.featuresBits[feature.bit] = 1;
        }
        node.featuresBits = bin2hex(node.featuresBits.reverse().join(''));
      }

      // Active channels and capacity
      const activeChannelsStats: any = await this.$getActiveChannelsStats(public_key);
      node.active_channel_count = activeChannelsStats.active_channel_count ?? 0;
      node.capacity = activeChannelsStats.capacity ?? 0;

      // Opened channels count
      query = `
        SELECT count(short_id) as opened_channel_count
        FROM channels
        WHERE status != 2 AND (channels.node1_public_key = ? OR channels.node2_public_key = ?)
      `;
      [rows] = await DB.query(query, [public_key, public_key]);
      node.opened_channel_count = 0;
      if (rows.length > 0) {
        node.opened_channel_count = rows[0].opened_channel_count;
      }

      // Closed channels count
      query = `
        SELECT count(short_id) as closed_channel_count
        FROM channels
        WHERE status = 2 AND (channels.node1_public_key = ? OR channels.node2_public_key = ?)
      `;
      [rows] = await DB.query(query, [public_key, public_key]);
      node.closed_channel_count = 0;
      if (rows.length > 0) {
        node.closed_channel_count = rows[0].closed_channel_count;
      }

      // Custom records
      query = `
        SELECT type, payload
        FROM nodes_records
        WHERE public_key = ?
      `;
      [rows] = await DB.query(query, [public_key]);
      node.custom_records = {};
      for (const record of rows) {
        node.custom_records[record.type] = Buffer.from(record.payload, 'binary').toString('hex');
      }

      return node;
    } catch (e) {
      logger.err(`Cannot get node information for ${public_key}. Reason: ${(e instanceof Error ? e.message : e)}`);
      throw e;
    }
  }

  public async $getActiveChannelsStats(node_public_key: string): Promise<unknown> {
    const query = `
      SELECT count(short_id) as active_channel_count, sum(capacity) as capacity
      FROM channels
      WHERE status = 1 AND (channels.node1_public_key = ? OR channels.node2_public_key = ?)
    `;
    const [rows]: any[] = await DB.query(query, [node_public_key, node_public_key]);
    if (rows.length > 0) {
      return {
        active_channel_count: rows[0].active_channel_count,
        capacity: rows[0].capacity
      };
    } else {
      return null;
    }
  }

  public async $getFeeHistogram(node_public_key: string): Promise<unknown> {
    try {
      const inQuery = `
        SELECT CASE WHEN fee_rate <= 10.0 THEN CEIL(fee_rate)
                    WHEN (fee_rate > 10.0 and fee_rate <= 100.0) THEN CEIL(fee_rate / 10.0) * 10.0
                    WHEN (fee_rate > 100.0 and fee_rate <= 1000.0) THEN CEIL(fee_rate / 100.0) * 100.0
                    WHEN fee_rate > 1000.0 THEN CEIL(fee_rate / 1000.0) * 1000.0
               END as bucket,
               count(short_id) as count,
               sum(capacity) as capacity
        FROM (
          SELECT CASE WHEN node1_public_key = ? THEN node2_fee_rate WHEN node2_public_key = ? THEN node1_fee_rate END as fee_rate,
                 short_id as short_id,
                 capacity as capacity
          FROM channels
          WHERE status = 1 AND (channels.node1_public_key = ? OR channels.node2_public_key = ?)
        ) as fee_rate_table
        GROUP BY bucket;
      `;
      const [inRows]: any[] = await DB.query(inQuery, [node_public_key, node_public_key, node_public_key, node_public_key]);

      const outQuery = `
        SELECT CASE WHEN fee_rate <= 10.0 THEN CEIL(fee_rate)
                    WHEN (fee_rate > 10.0 and fee_rate <= 100.0) THEN CEIL(fee_rate / 10.0) * 10.0
                    WHEN (fee_rate > 100.0 and fee_rate <= 1000.0) THEN CEIL(fee_rate / 100.0) * 100.0
                    WHEN fee_rate > 1000.0 THEN CEIL(fee_rate / 1000.0) * 1000.0
               END as bucket,
               count(short_id) as count,
               sum(capacity) as capacity
        FROM (
          SELECT CASE WHEN node1_public_key = ? THEN node1_fee_rate WHEN node2_public_key = ? THEN node2_fee_rate END as fee_rate,
                 short_id as short_id,
                 capacity as capacity
          FROM channels
          WHERE status = 1 AND (channels.node1_public_key = ? OR channels.node2_public_key = ?)
        ) as fee_rate_table
        GROUP BY bucket;
      `;
      const [outRows]: any[] = await DB.query(outQuery, [node_public_key, node_public_key, node_public_key, node_public_key]);

      return {
        incoming: inRows.length > 0 ? inRows : [],
        outgoing: outRows.length > 0 ? outRows : [],
      };
    } catch (e) {
      logger.err(`Cannot get node fee distribution for ${node_public_key}. Reason: ${(e instanceof Error ? e.message : e)}`);
      throw e;
    }
  }

  public async $getAllNodes(): Promise<any> {
    try {
      const query = `SELECT * FROM nodes`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getAllNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getNodeStats(public_key: string): Promise<any> {
    try {
      const query = `
        SELECT UNIX_TIMESTAMP(added) AS added, capacity, channels
        FROM node_stats
        WHERE public_key = ?
        ORDER BY added DESC
      `;
      const [rows]: any = await DB.query(query, [public_key]);
      return rows;
    } catch (e) {
      logger.err('$getNodeStats error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopCapacityNodes(full: boolean): Promise<ITopNodesPerCapacity[]> {
    try {
      let rows: any;
      let query: string;
      if (full === false) {
        query = `
          SELECT nodes.public_key AS publicKey, IF(nodes.alias = '', SUBSTRING(nodes.public_key, 1, 20), alias) as alias,
            nodes.capacity
          FROM nodes
          ORDER BY capacity DESC
          LIMIT 6
        `;

        [rows] = await DB.query(query);
      } else {
        query = `
          SELECT nodes.public_key AS publicKey, IF(nodes.alias = '', SUBSTRING(nodes.public_key, 1, 20), alias) as alias,
            CAST(COALESCE(nodes.capacity, 0) as INT) as capacity,
            CAST(COALESCE(nodes.channels, 0) as INT) as channels,
            UNIX_TIMESTAMP(nodes.first_seen) as firstSeen, UNIX_TIMESTAMP(nodes.updated_at) as updatedAt,
            geo_names_city.names as city, geo_names_country.names as country,
            geo_names_iso.names as iso_code, geo_names_subdivision.names as subdivision
          FROM nodes
          LEFT JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
          LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id AND geo_names_city.type = 'city'
          LEFT JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
          LEFT JOIN geo_names geo_names_subdivision on geo_names_subdivision.id = nodes.subdivision_id AND geo_names_subdivision.type = 'division'
          ORDER BY capacity DESC
          LIMIT 100
        `;

        [rows] = await DB.query(query);
        for (let i = 0; i < rows.length; ++i) {
          rows[i].country = JSON.parse(rows[i].country);
          rows[i].city = JSON.parse(rows[i].city);
        }
      }

      return rows;
    } catch (e) {
      logger.err('$getTopCapacityNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopChannelsNodes(full: boolean): Promise<ITopNodesPerChannels[]> {
    try {
      let rows: any;
      let query: string;
      if (full === false) {
        query = `
          SELECT
            nodes.public_key as publicKey,
            IF(nodes.alias = '', SUBSTRING(nodes.public_key, 1, 20), alias) as alias,
            nodes.channels,
            geo_names_city.names as city, geo_names_country.names as country,
            geo_names_iso.names as iso_code, geo_names_subdivision.names as subdivision
          FROM nodes
          LEFT JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
          LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id AND geo_names_city.type = 'city'
          LEFT JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
          LEFT JOIN geo_names geo_names_subdivision on geo_names_subdivision.id = nodes.subdivision_id AND geo_names_subdivision.type = 'division'
          ORDER BY channels DESC
          LIMIT 6;
        `;

        [rows] = await DB.query(query);
        for (let i = 0; i < rows.length; ++i) {
          rows[i].country = JSON.parse(rows[i].country);
          rows[i].city = JSON.parse(rows[i].city);
        }
      } else {
        query = `
          SELECT nodes.public_key AS publicKey, IF(nodes.alias = '', SUBSTRING(nodes.public_key, 1, 20), alias) as alias,
            CAST(COALESCE(nodes.channels, 0) as INT) as channels,
            CAST(COALESCE(nodes.capacity, 0) as INT) as capacity,
            UNIX_TIMESTAMP(nodes.first_seen) as firstSeen, UNIX_TIMESTAMP(nodes.updated_at) as updatedAt,
            geo_names_city.names as city, geo_names_country.names as country,
            geo_names_iso.names as iso_code, geo_names_subdivision.names as subdivision
          FROM nodes
          LEFT JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
          LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id AND geo_names_city.type = 'city'
          LEFT JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
          LEFT JOIN geo_names geo_names_subdivision on geo_names_subdivision.id = nodes.subdivision_id AND geo_names_subdivision.type = 'division'
          ORDER BY channels DESC
          LIMIT 100
        `;

        [rows] = await DB.query(query);
        for (let i = 0; i < rows.length; ++i) {
          rows[i].country = JSON.parse(rows[i].country);
          rows[i].city = JSON.parse(rows[i].city);
        }
      }

      return rows;
    } catch (e) {
      logger.err('$getTopChannelsNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getOldestNodes(full: boolean): Promise<ITopNodesPerChannels[]> {
    try {
      let [rows]: any[] = await DB.query('SELECT UNIX_TIMESTAMP(MAX(added)) as maxAdded FROM node_stats');
      const latestDate = rows[0].maxAdded;

      let query: string;
      if (full === false) {
        query = `
          SELECT nodes.public_key, IF(nodes.alias = '', SUBSTRING(nodes.public_key, 1, 20), alias) as alias,
            node_stats.channels
          FROM node_stats
          JOIN nodes ON nodes.public_key = node_stats.public_key
          WHERE added = FROM_UNIXTIME(${latestDate})
          ORDER BY first_seen
          LIMIT 100;
        `;

        [rows] = await DB.query(query);
      } else {
        query = `
          SELECT node_stats.public_key AS publicKey, IF(nodes.alias = '', SUBSTRING(node_stats.public_key, 1, 20), alias) as alias,
            CAST(COALESCE(node_stats.channels, 0) as INT) as channels,
            CAST(COALESCE(node_stats.capacity, 0) as INT) as capacity,
            UNIX_TIMESTAMP(nodes.first_seen) as firstSeen, UNIX_TIMESTAMP(nodes.updated_at) as updatedAt,
            geo_names_city.names as city, geo_names_country.names as country,
            geo_names_iso.names as iso_code, geo_names_subdivision.names as subdivision
          FROM node_stats
          RIGHT JOIN nodes ON nodes.public_key = node_stats.public_key
          LEFT JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
          LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id AND geo_names_city.type = 'city'
          LEFT JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
          LEFT JOIN geo_names geo_names_subdivision on geo_names_subdivision.id = nodes.subdivision_id AND geo_names_subdivision.type = 'division'
          WHERE added = FROM_UNIXTIME(${latestDate})
          ORDER BY first_seen
          LIMIT 100
        `;

        [rows] = await DB.query(query);
        for (let i = 0; i < rows.length; ++i) {
          rows[i].country = JSON.parse(rows[i].country);
          rows[i].city = JSON.parse(rows[i].city);
        }
      }

      return rows;
    } catch (e) {
      logger.err('$getTopChannelsNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $searchNodeByPublicKeyOrAlias(search: string) {
    try {
      const publicKeySearch = search.replace(/[^a-zA-Z0-9]/g, '') + '%';
      const aliasSearch = search
        .replace(/[-_.]/g, ' ') // Replace all -_. characters with empty space. Eg: "ln.nicehash" becomes "ln nicehash".  
        .replace(/[^a-zA-Z0-9 ]/g, '') // Remove all special characters and keep just A to Z, 0 to 9.
        .split(' ')
        .filter(key => key.length)
        .map((search) => '+' + search + '*').join(' ');
      // %keyword% is wildcard search and can't be indexed so it's slower as the node database grow. keyword% can be indexed but then you can't search for "Nicehash" and get result for ln.nicehash.com. So we use fulltext index for words "ln, nicehash, com" and nicehash* will find it instantly.
      const query = `SELECT public_key, alias, capacity, channels, status FROM nodes WHERE public_key LIKE ? OR MATCH alias_search AGAINST (? IN BOOLEAN MODE) ORDER BY capacity DESC LIMIT 10`;
      const [rows]: any = await DB.query(query, [publicKeySearch, aliasSearch]);
      return rows;
    } catch (e) {
      logger.err('$searchNodeByPublicKeyOrAlias error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getNodesISPRanking() {
    try {
      let query = '';

      // List all channels and the two linked ISP
      query = `
        SELECT short_id, channels.capacity,
          channels.node1_public_key AS node1PublicKey, isp1.names AS isp1, isp1.id as isp1ID,
          channels.node2_public_key AS node2PublicKey, isp2.names AS isp2, isp2.id as isp2ID
        FROM channels
        JOIN nodes node1 ON node1.public_key = channels.node1_public_key
        JOIN nodes node2 ON node2.public_key = channels.node2_public_key
        JOIN geo_names isp1 ON isp1.id = node1.as_number
        JOIN geo_names isp2 ON isp2.id = node2.as_number
        WHERE channels.status = 1
        ORDER BY short_id DESC
      `;
      const [channelsIsp]: any = await DB.query(query);

      // Sum channels capacity and node count per ISP
      const ispList = {};
      for (const channel of channelsIsp) {
        const isp1 = JSON.parse(channel.isp1);
        const isp2 = JSON.parse(channel.isp2);

        if (!ispList[isp1]) {
          ispList[isp1] = {
            ids: [channel.isp1ID],
            capacity: 0,
            channels: 0,
            nodes: {},
          };
        } else if (ispList[isp1].ids.includes(channel.isp1ID) === false) {
          ispList[isp1].ids.push(channel.isp1ID);
        }

        if (!ispList[isp2]) {
          ispList[isp2] = {
            ids: [channel.isp2ID],
            capacity: 0,
            channels: 0,
            nodes: {},
          };
        } else if (ispList[isp2].ids.includes(channel.isp2ID) === false) {
          ispList[isp2].ids.push(channel.isp2ID);
        }
        
        ispList[isp1].capacity += channel.capacity;
        ispList[isp1].channels += 1;
        ispList[isp1].nodes[channel.node1PublicKey] = true;
        ispList[isp2].capacity += channel.capacity;
        ispList[isp2].channels += 1;
        ispList[isp2].nodes[channel.node2PublicKey] = true;
      }
      
      const ispRanking: any[] = [];
      for (const isp of Object.keys(ispList)) {
        ispRanking.push([
          ispList[isp].ids.sort((a, b) => a - b).join(','),
          isp,
          ispList[isp].capacity,
          ispList[isp].channels,
          Object.keys(ispList[isp].nodes).length,
        ]);
      }

      // Total active channels capacity
      query = `SELECT SUM(capacity) AS capacity FROM channels WHERE status = 1`;
      const [totalCapacity]: any = await DB.query(query);

      // Get the total capacity of all channels which have at least one node on clearnet
      query = `
        SELECT SUM(capacity) as capacity
        FROM (
          SELECT capacity, GROUP_CONCAT(socket1.type, socket2.type) as networks
          FROM channels
          JOIN nodes_sockets socket1 ON node1_public_key = socket1.public_key
          JOIN nodes_sockets socket2 ON node2_public_key = socket2.public_key
          AND channels.status = 1
          GROUP BY short_id
        ) channels_tmp
        WHERE channels_tmp.networks LIKE '%ipv%'
      `;
      const [clearnetCapacity]: any = await DB.query(query);

      // Get the total capacity of all channels which have both nodes on Tor 
      query = `
        SELECT SUM(capacity) as capacity
        FROM (
          SELECT capacity, GROUP_CONCAT(socket1.type, socket2.type) as networks
          FROM channels
          JOIN nodes_sockets socket1 ON node1_public_key = socket1.public_key
          JOIN nodes_sockets socket2 ON node2_public_key = socket2.public_key
          AND channels.status = 1
          GROUP BY short_id
        ) channels_tmp
        WHERE channels_tmp.networks NOT LIKE '%ipv%' AND
          channels_tmp.networks NOT LIKE '%dns%' AND
          channels_tmp.networks NOT LIKE '%websocket%'
      `;
      const [torCapacity]: any = await DB.query(query);

      const clearnetCapacityValue = parseInt(clearnetCapacity[0].capacity, 10);
      const torCapacityValue = parseInt(torCapacity[0].capacity, 10);
      const unknownCapacityValue = parseInt(totalCapacity[0].capacity) - clearnetCapacityValue - torCapacityValue;

      return {
        clearnetCapacity: clearnetCapacityValue,
        torCapacity: torCapacityValue,
        unknownCapacity: unknownCapacityValue,
        ispRanking: ispRanking,
      };
    } catch (e) {
      logger.err(`Cannot get LN ISP ranking. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $getNodesPerCountry(countryId: string) {
    try {
      const query = `
        SELECT nodes.public_key, CAST(COALESCE(nodes.capacity, 0) as INT) as capacity, CAST(COALESCE(nodes.channels, 0) as INT) as channels,
          nodes.alias, UNIX_TIMESTAMP(nodes.first_seen) as first_seen, UNIX_TIMESTAMP(nodes.updated_at) as updated_at,
          geo_names_city.names as city, geo_names_country.names as country,
          geo_names_iso.names as iso_code, geo_names_subdivision.names as subdivision,
          nodes.longitude, nodes.latitude, nodes.as_number, geo_names_isp.names as isp
        FROM nodes
        LEFT JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
        LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id AND geo_names_city.type = 'city'
        LEFT JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
        LEFT JOIN geo_names geo_names_subdivision on geo_names_subdivision.id = nodes.subdivision_id AND geo_names_subdivision.type = 'division'
        LEFT JOIN geo_names geo_names_isp on geo_names_isp.id = nodes.as_number AND geo_names_isp.type = 'as_organization'
        WHERE geo_names_country.id = ?
        ORDER BY capacity DESC
      `;

      const [rows]: any = await DB.query(query, [countryId]);
      for (let i = 0; i < rows.length; ++i) {
        rows[i].country = JSON.parse(rows[i].country);
        rows[i].city = JSON.parse(rows[i].city);
        rows[i].subdivision = JSON.parse(rows[i].subdivision);
        rows[i].isp = JSON.parse(rows[i].isp);
      }
      return rows;
    } catch (e) {
      logger.err(`Cannot get nodes for country id ${countryId}. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $getNodesPerISP(ISPId: string) {
    try {
      let query = `
        SELECT channels.node1_public_key AS node1PublicKey, isp1.id as isp1ID,
          channels.node2_public_key AS node2PublicKey, isp2.id as isp2ID
        FROM channels
        JOIN nodes node1 ON node1.public_key = channels.node1_public_key
        JOIN nodes node2 ON node2.public_key = channels.node2_public_key
        JOIN geo_names isp1 ON isp1.id = node1.as_number
        JOIN geo_names isp2 ON isp2.id = node2.as_number
        WHERE channels.status = 1 AND (node1.as_number IN (?) OR node2.as_number IN (?))
        ORDER BY short_id DESC
      `;

      const IPSIds = ISPId.split(',');
      const [rows]: any = await DB.query(query, [IPSIds, IPSIds]);
      if (!rows || rows.length === 0) {
        return [];
      }

      const nodes = {};

      const intISPIds: number[] = [];
      for (const ispId of IPSIds) {
        intISPIds.push(parseInt(ispId, 10));
      }

      for (const channel of rows) {
        if (intISPIds.includes(channel.isp1ID)) {
          nodes[channel.node1PublicKey] = true;
        }
        if (intISPIds.includes(channel.isp2ID)) {
          nodes[channel.node2PublicKey] = true;
        }
      }

      query = `
        SELECT nodes.public_key, CAST(COALESCE(nodes.capacity, 0) as INT) as capacity, CAST(COALESCE(nodes.channels, 0) as INT) as channels,
          nodes.alias, UNIX_TIMESTAMP(nodes.first_seen) as first_seen, UNIX_TIMESTAMP(nodes.updated_at) as updated_at,
          geo_names_city.names as city, geo_names_country.names as country,
          geo_names_iso.names as iso_code, geo_names_subdivision.names as subdivision,
          nodes.longitude, nodes.latitude
        FROM nodes
        LEFT JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
        LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id AND geo_names_city.type = 'city'
        LEFT JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
        LEFT JOIN geo_names geo_names_subdivision on geo_names_subdivision.id = nodes.subdivision_id AND geo_names_subdivision.type = 'division'
        WHERE nodes.public_key IN (?)
        ORDER BY capacity DESC
      `;

      const [rows2]: any = await DB.query(query, [Object.keys(nodes)]);
      for (let i = 0; i < rows2.length; ++i) {
        rows2[i].country = JSON.parse(rows2[i].country);
        rows2[i].city = JSON.parse(rows2[i].city);
        rows2[i].subdivision = JSON.parse(rows2[i].subdivision);
      }
      return rows2;

    } catch (e) {
      logger.err(`Cannot get nodes for ISP id ${ISPId}. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $getNodesCountries() {
    try {
      let query = `SELECT geo_names.names as names, geo_names_iso.names as iso_code, COUNT(DISTINCT nodes.public_key) as nodesCount, SUM(capacity) as capacity
        FROM nodes
        JOIN geo_names ON geo_names.id = nodes.country_id AND geo_names.type = 'country'
        JOIN geo_names geo_names_iso ON geo_names_iso.id = nodes.country_id AND geo_names_iso.type = 'country_iso_code'
        GROUP BY country_id
        ORDER BY COUNT(DISTINCT nodes.public_key) DESC
      `;
      const [nodesCountPerCountry]: any = await DB.query(query);

      query = `SELECT COUNT(*) as total FROM nodes WHERE country_id IS NOT NULL`;
      const [nodesWithAS]: any = await DB.query(query);

      const nodesPerCountry: any[] = [];
      for (const country of nodesCountPerCountry) {
        nodesPerCountry.push({
          name: JSON.parse(country.names),
          iso: country.iso_code, 
          count: country.nodesCount,
          share: Math.floor(country.nodesCount / nodesWithAS[0].total * 10000) / 100,
          capacity: country.capacity,
        })
      }

      return nodesPerCountry;
    } catch (e) {
      logger.err(`Cannot get nodes grouped by AS. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  /**
   * Save or update a node present in the graph
   */
  public async $saveNode(node: ILightningApi.Node): Promise<void> {
    try {
      // https://github.com/mempool/mempool/issues/3006
      if ((node.last_update ?? 0) < 1514736061) { // January 1st 2018
        node.last_update = null;
      }
  
      const uniqueAddr = [...new Set(node.addresses?.map(a => a.addr))];
      const formattedSockets = (uniqueAddr.join(',')) ?? '';

      const query = `INSERT INTO nodes(
          public_key,
          first_seen,
          updated_at,
          alias,
          alias_search,
          color,
          sockets,
          status,
          features
        )
        VALUES (?, NOW(), FROM_UNIXTIME(?), ?, ?, ?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
          updated_at = FROM_UNIXTIME(?),
          alias = ?,
          alias_search = ?,
          color = ?,
          sockets = ?,
          status = 1,
          features = ?
      `;

      await DB.query(query, [
        node.pub_key,
        node.last_update,
        node.alias,
        this.aliasToSearchText(node.alias),
        node.color,
        formattedSockets,
        JSON.stringify(node.features),
        node.last_update,
        node.alias,
        this.aliasToSearchText(node.alias),
        node.color,
        formattedSockets,
        JSON.stringify(node.features),
      ]);
    } catch (e) {
      logger.err('$saveNode() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Update node sockets
   */
  public async $updateNodeSockets(publicKey: string, sockets: {network: string; addr: string}[]): Promise<void> {
    const uniqueAddr = [...new Set(sockets.map(a => a.addr))];

    const formattedSockets = (uniqueAddr.join(',')) ?? '';
    try {
      await DB.query(`UPDATE nodes SET sockets = ? WHERE public_key = ?`, [formattedSockets, publicKey]);
    } catch (e) {
      logger.err(`Cannot update node sockets for ${publicKey}. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

  /**
   * Set all nodes not in `nodesPubkeys` as inactive (status = 0)
   */
   public async $setNodesInactive(graphNodesPubkeys: string[]): Promise<void> {
    if (graphNodesPubkeys.length === 0) {
      return;
    }

    try {
      const result = await DB.query<ResultSetHeader>(`
        UPDATE nodes
        SET status = 0
        WHERE public_key NOT IN (
          ${graphNodesPubkeys.map(pubkey => `"${pubkey}"`).join(',')}
        )
      `);
      if (result[0].changedRows ?? 0 > 0) {
        logger.debug(`Marked ${result[0].changedRows} nodes as inactive because they are not in the graph`, logger.tags.ln);
      }
    } catch (e) {
      logger.err('$setNodesInactive() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private aliasToSearchText(str: string): string {
    return str.replace(/[-_.]/g, ' ').replace(/[^a-zA-Z0-9 ]/g, '');
  }
}

export default new NodesApi();
