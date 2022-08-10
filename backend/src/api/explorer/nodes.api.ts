import logger from '../../logger';
import DB from '../../database';
import { ResultSetHeader } from 'mysql2';
import { ILightningApi } from '../lightning/lightning-api.interface';

class NodesApi {
  public async $getNode(public_key: string): Promise<any> {
    try {
      // General info
      let query = `
        SELECT public_key, alias, UNIX_TIMESTAMP(first_seen) AS first_seen,
        UNIX_TIMESTAMP(updated_at) AS updated_at, color, sockets as sockets,
        as_number, city_id, country_id, subdivision_id, longitude, latitude,
        geo_names_iso.names as iso_code, geo_names_as.names as as_organization, geo_names_city.names as city,
        geo_names_country.names as country, geo_names_subdivision.names as subdivision
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

  public async $getTopCapacityNodes(): Promise<any> {
    try {
      let [rows]: any[] = await DB.query('SELECT UNIX_TIMESTAMP(MAX(added)) as maxAdded FROM node_stats');
      const latestDate = rows[0].maxAdded;

      const query = `
        SELECT nodes.public_key, IF(nodes.alias = '', SUBSTRING(nodes.public_key, 1, 20), alias) as alias, node_stats.capacity, node_stats.channels
        FROM node_stats
        JOIN nodes ON nodes.public_key = node_stats.public_key
        WHERE added = FROM_UNIXTIME(${latestDate})
        ORDER BY capacity DESC
        LIMIT 10;
      `;
      [rows] = await DB.query(query);

      return rows;
    } catch (e) {
      logger.err('$getTopCapacityNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopChannelsNodes(): Promise<any> {
    try {
      let [rows]: any[] = await DB.query('SELECT UNIX_TIMESTAMP(MAX(added)) as maxAdded FROM node_stats');
      const latestDate = rows[0].maxAdded;

      const query = `
        SELECT nodes.public_key, IF(nodes.alias = '', SUBSTRING(nodes.public_key, 1, 20), alias) as alias, node_stats.capacity, node_stats.channels
        FROM node_stats
        JOIN nodes ON nodes.public_key = node_stats.public_key
        WHERE added = FROM_UNIXTIME(${latestDate})
        ORDER BY channels DESC
        LIMIT 10;
      `;
      [rows] = await DB.query(query);

      return rows;
    } catch (e) {
      logger.err('$getTopChannelsNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $searchNodeByPublicKeyOrAlias(search: string) {
    try {
      const searchStripped = search.replace('%', '') + '%';
      const query = `SELECT nodes.public_key, nodes.alias, node_stats.capacity FROM nodes LEFT JOIN node_stats ON node_stats.public_key = nodes.public_key WHERE nodes.public_key LIKE ? OR nodes.alias LIKE ? GROUP BY nodes.public_key ORDER BY node_stats.capacity DESC LIMIT 10`;
      const [rows]: any = await DB.query(query, [searchStripped, searchStripped]);
      return rows;
    } catch (e) {
      logger.err('$searchNodeByPublicKeyOrAlias error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getNodesISP(groupBy: string, showTor: boolean) {
    try {
      const orderBy = groupBy === 'capacity' ? `CAST(SUM(capacity) as INT)` : `COUNT(DISTINCT nodes.public_key)`;
      
      // Clearnet
      let query = `SELECT GROUP_CONCAT(DISTINCT(nodes.as_number)) as ispId, geo_names.names as names,
          COUNT(DISTINCT nodes.public_key) as nodesCount, CAST(SUM(capacity) as INT) as capacity
        FROM nodes
        JOIN geo_names ON geo_names.id = nodes.as_number
        JOIN channels ON channels.node1_public_key = nodes.public_key OR channels.node2_public_key = nodes.public_key
        GROUP BY geo_names.names
        ORDER BY ${orderBy} DESC
      `;      
      const [nodesCountPerAS]: any = await DB.query(query);

      let total = 0;
      const nodesPerAs: any[] = [];

      for (const asGroup of nodesCountPerAS) {
        if (groupBy === 'capacity') {
          total += asGroup.capacity;
        } else {
          total += asGroup.nodesCount;
        }
      }

      // Tor
      if (showTor) {
        query = `SELECT COUNT(DISTINCT nodes.public_key) as nodesCount, CAST(SUM(capacity) as INT) as capacity
          FROM nodes
          JOIN channels ON channels.node1_public_key = nodes.public_key OR channels.node2_public_key = nodes.public_key
          ORDER BY ${orderBy} DESC
        `;      
        const [nodesCountTor]: any = await DB.query(query);

        total += groupBy === 'capacity' ? nodesCountTor[0].capacity : nodesCountTor[0].nodesCount;
        nodesPerAs.push({
          ispId: null,
          name: 'Tor',
          count: nodesCountTor[0].nodesCount,
          share: Math.floor((groupBy === 'capacity' ? nodesCountTor[0].capacity : nodesCountTor[0].nodesCount) / total * 10000) / 100,
          capacity: nodesCountTor[0].capacity,
        });
      }

      for (const as of nodesCountPerAS) {
        nodesPerAs.push({
          ispId: as.ispId,
          name: JSON.parse(as.names),
          count: as.nodesCount,
          share: Math.floor((groupBy === 'capacity' ? as.capacity : as.nodesCount) / total * 10000) / 100,
          capacity: as.capacity,
        });
      }

      return nodesPerAs;
    } catch (e) {
      logger.err(`Cannot get nodes grouped by AS. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $getNodesPerCountry(countryId: string) {
    try {
      const query = `
      SELECT nodes.public_key, CAST(COALESCE(node_stats.capacity, 0) as INT) as capacity, CAST(COALESCE(node_stats.channels, 0) as INT) as channels,
      nodes.alias, UNIX_TIMESTAMP(nodes.first_seen) as first_seen, UNIX_TIMESTAMP(nodes.updated_at) as updated_at,
          geo_names_city.names as city
        FROM node_stats
        JOIN (
          SELECT public_key, MAX(added) as last_added
          FROM node_stats
          GROUP BY public_key
        ) as b ON b.public_key = node_stats.public_key AND b.last_added = node_stats.added
        RIGHT JOIN nodes ON nodes.public_key = node_stats.public_key
        JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
        LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id AND geo_names_city.type = 'city'
        WHERE geo_names_country.id = ?
        ORDER BY capacity DESC
      `;

      const [rows]: any = await DB.query(query, [countryId]);
      for (let i = 0; i < rows.length; ++i) {
        rows[i].city = JSON.parse(rows[i].city);
      }
      return rows;
    } catch (e) {
      logger.err(`Cannot get nodes for country id ${countryId}. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $getNodesPerISP(ISPId: string) {
    try {
      const query = `
        SELECT nodes.public_key, CAST(COALESCE(node_stats.capacity, 0) as INT) as capacity, CAST(COALESCE(node_stats.channels, 0) as INT) as channels,
          nodes.alias, UNIX_TIMESTAMP(nodes.first_seen) as first_seen, UNIX_TIMESTAMP(nodes.updated_at) as updated_at,
          geo_names_city.names as city, geo_names_country.names as country
        FROM node_stats
        JOIN (
          SELECT public_key, MAX(added) as last_added
          FROM node_stats
          GROUP BY public_key
        ) as b ON b.public_key = node_stats.public_key AND b.last_added = node_stats.added
        RIGHT JOIN nodes ON nodes.public_key = node_stats.public_key
        JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id AND geo_names_country.type = 'country'
        LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id AND geo_names_city.type = 'city'
        WHERE nodes.as_number IN (?)
        ORDER BY capacity DESC
      `;

      const [rows]: any = await DB.query(query, [ISPId.split(',')]);
      for (let i = 0; i < rows.length; ++i) {
        rows[i].country = JSON.parse(rows[i].country);
        rows[i].city = JSON.parse(rows[i].city);
      }
      return rows;
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
        JOIN channels ON channels.node1_public_key = nodes.public_key OR channels.node2_public_key = nodes.public_key
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
      const sockets = (node.addresses?.map(a => a.addr).join(',')) ?? '';
      const query = `INSERT INTO nodes(
          public_key,
          first_seen,
          updated_at,
          alias,
          color,
          sockets,
          status
        )
        VALUES (?, NOW(), FROM_UNIXTIME(?), ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE updated_at = FROM_UNIXTIME(?), alias = ?, color = ?, sockets = ?, status = 1`;

      await DB.query(query, [
        node.pub_key,
        node.last_update,
        node.alias,
        node.color,
        sockets,
        node.last_update,
        node.alias,
        node.color,
        sockets,
      ]);
    } catch (e) {
      logger.err('$saveNode() error: ' + (e instanceof Error ? e.message : e));
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
        logger.info(`Marked ${result[0].changedRows} nodes as inactive because they are not in the graph`);
      } else {
        logger.debug(`Marked ${result[0].changedRows} nodes as inactive because they are not in the graph`);
      }
    } catch (e) {
      logger.err('$setNodesInactive() error: ' + (e instanceof Error ? e.message : e));
    }
  }
}

export default new NodesApi();
