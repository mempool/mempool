import logger from '../../logger';
import DB from '../../database';

class NodesApi {
  public async $getNode(public_key: string): Promise<any> {
    try {
      const query = `
        SELECT nodes.*, geo_names_as.names as as_organization, geo_names_city.names as city,
        geo_names_country.names as country, geo_names_subdivision.names as subdivision,
          (SELECT Count(*)
          FROM channels
          WHERE channels.status < 2 AND ( channels.node1_public_key = ? OR channels.node2_public_key = ? )) AS channel_count,
          (SELECT Sum(capacity)
          FROM channels
          WHERE channels.status < 2 AND ( channels.node1_public_key = ? OR channels.node2_public_key = ? )) AS capacity,
          (SELECT Avg(capacity)
          FROM channels
          WHERE status < 2 AND ( node1_public_key = ? OR node2_public_key = ? )) AS channels_capacity_avg
        FROM nodes
        LEFT JOIN geo_names geo_names_as on geo_names_as.id = as_number
        LEFT JOIN geo_names geo_names_city on geo_names_city.id = city_id
        LEFT JOIN geo_names geo_names_subdivision on geo_names_subdivision.id = subdivision_id
        LEFT JOIN geo_names geo_names_country on geo_names_country.id = country_id
        WHERE public_key = ?
      `;
      const [rows]: any = await DB.query(query, [public_key, public_key, public_key, public_key, public_key, public_key, public_key]);
      if (rows.length > 0) {
        rows[0].as_organization = JSON.parse(rows[0].as_organization);
        rows[0].subdivision = JSON.parse(rows[0].subdivision);
        rows[0].city = JSON.parse(rows[0].city);
        rows[0].country = JSON.parse(rows[0].country);
        return rows[0];
      }
      return null;
    } catch (e) {
      logger.err('$getNode error: ' + (e instanceof Error ? e.message : e));
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
      const query = `SELECT UNIX_TIMESTAMP(added) AS added, capacity, channels FROM node_stats WHERE public_key = ? ORDER BY added DESC`;
      const [rows]: any = await DB.query(query, [public_key]);
      return rows;
    } catch (e) {
      logger.err('$getNodeStats error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopCapacityNodes(): Promise<any> {
    try {
      const query = `SELECT nodes.*, node_stats.capacity, node_stats.channels FROM nodes LEFT JOIN node_stats ON node_stats.public_key = nodes.public_key ORDER BY node_stats.added DESC, node_stats.capacity DESC LIMIT 10`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getTopCapacityNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopChannelsNodes(): Promise<any> {
    try {
      const query = `SELECT nodes.*, node_stats.capacity, node_stats.channels FROM nodes LEFT JOIN node_stats ON node_stats.public_key = nodes.public_key ORDER BY node_stats.added DESC, node_stats.channels DESC LIMIT 10`;
      const [rows]: any = await DB.query(query);
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

  public async $getNodesAsShare() {
    try {
      let query = `SELECT names, COUNT(DISTINCT nodes.public_key) as nodesCount, SUM(capacity) as capacity
        FROM nodes
        JOIN geo_names ON geo_names.id = nodes.as_number
        JOIN channels ON channels.node1_public_key = nodes.public_key OR channels.node2_public_key = nodes.public_key
        GROUP BY as_number
        ORDER BY COUNT(DISTINCT nodes.public_key) DESC
      `;
      const [nodesCountPerAS]: any = await DB.query(query);

      query = `SELECT COUNT(*) as total FROM nodes WHERE as_number IS NOT NULL`;
      const [nodesWithAS]: any = await DB.query(query);

      const nodesPerAs: any[] = [];
      for (const as of nodesCountPerAS) {
        nodesPerAs.push({
          name: JSON.parse(as.names),
          count: as.nodesCount,
          share: Math.floor(as.nodesCount / nodesWithAS[0].total * 10000) / 100,
          capacity: as.capacity,
        })
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
        SELECT DISTINCT   node_stats.public_key, node_stats.capacity, node_stats.channels, nodes.alias,
          UNIX_TIMESTAMP(nodes.first_seen) as first_seen, UNIX_TIMESTAMP(nodes.updated_at) as updated_at,
          geo_names_city.names as city
        FROM node_stats
        JOIN (
          SELECT public_key, MAX(added) as last_added
          FROM node_stats
          GROUP BY public_key
        ) as b ON b.public_key = node_stats.public_key AND b.last_added = node_stats.added
        JOIN nodes ON nodes.public_key = node_stats.public_key
        JOIN geo_names geo_names_country ON geo_names_country.id = nodes.country_id
        LEFT JOIN geo_names geo_names_city ON geo_names_city.id = nodes.city_id
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
}

export default new NodesApi();
