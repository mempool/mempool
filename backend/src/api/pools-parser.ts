import {readFileSync} from 'fs';
import { DB } from '../database';
import logger from '../logger';

interface Pool {
  name: string,
  link: string,
  regexes: string[],
  addresses: string[],
}

class PoolsParser {
  /**
   * Parse the pools.json file, consolidate the data and dump it into the database
   */
  public async migratePoolsJson() {
    logger.info('Importing pools.json to the database');
    let connection = await DB.pool.getConnection();

    // Check if the pools table does not have data already, for now we do not support updating it
    // but that will come in a later version
    let [rows] = await connection.query<any>({ sql: 'SELECT count(id) as count from pools;', timeout: 120000 });
    if (rows[0].count !== 0) {
      logger.info('Pools table already contain data, updating it is not yet supported, skipping.');
      connection.release();
      return;
    }

    logger.info('Open ../frontend/cypress/fixtures/pools.json');
    const fileContent: string = readFileSync('../frontend/cypress/fixtures/pools.json','utf8');
    const poolsJson: object = JSON.parse(fileContent);

    // First we save every entries without paying attention to pool duplication
    let poolsDuplicated: Pool[] = [];

    logger.info('Parse coinbase_tags');
    const coinbaseTags = Object.entries(poolsJson['coinbase_tags']);
    for (let i = 0; i < coinbaseTags.length; ++i) {
      poolsDuplicated.push({
        'name': (<Pool>coinbaseTags[i][1]).name,
        'link': (<Pool>coinbaseTags[i][1]).link,
        'regexes': [coinbaseTags[i][0]],
        'addresses': [],
      });
    }
    logger.info('Parse payout_addresses');
    const addressesTags = Object.entries(poolsJson['payout_addresses']);
    for (let i = 0; i < addressesTags.length; ++i) {
      poolsDuplicated.push({
        'name': (<Pool>addressesTags[i][1]).name,
        'link': (<Pool>addressesTags[i][1]).link,
        'regexes': [],
        'addresses': [addressesTags[i][0]],
      });
    }

    // Then, we find unique mining pool names
    logger.info('Identify unique mining pools');
    let poolNames : string[] = [];
    for (let i = 0; i < poolsDuplicated.length; ++i) {
      if (poolNames.indexOf(poolsDuplicated[i].name) === -1) {
        poolNames.push(poolsDuplicated[i].name);
      }
    }
    logger.info(`Found ${poolNames.length} unique mining pools`);

    // Finally, we generate the final consolidated pools data
    let finalPoolData: Pool[] = [];
    for (let i = 0; i < poolNames.length; ++i) {
      let allAddresses: string[] = [];
      let allRegexes: string[] = [];
      let match = poolsDuplicated.filter((pool: Pool) => pool.name === poolNames[i]);

      for (let y = 0; y < match.length; ++y) {
        allAddresses = allAddresses.concat(match[y].addresses);
        allRegexes = allRegexes.concat(match[y].regexes);
      }

      finalPoolData.push({
        'name': poolNames[i].replace("'", "''"),
        'link': match[0].link,
        'regexes': allRegexes,
        'addresses': allAddresses,
      })
    }

    // Manually add the 'unknown pool'
    finalPoolData.push({
      'name': 'Unknown',
      'link': 'https://learnmeabitcoin.com/technical/coinbase-transaction',
      regexes: [],
      addresses: [],
    })

    // Dump everything into the database
    logger.info(`Insert mining pool info into the database`);
    let query: string = 'INSERT INTO pools(name, link, regexes, addresses) VALUES ';
    for (let i = 0; i < finalPoolData.length; ++i) {
      query += `('${finalPoolData[i].name}', '${finalPoolData[i].link}',
        '${JSON.stringify(finalPoolData[i].regexes)}', '${JSON.stringify(finalPoolData[i].addresses)}'),`;
    }
    query = query.slice(0, -1) + ';';

    try {
      await connection.query<any>({ sql: 'DELETE FROM pools;', timeout: 120000 }); // We clear the table before insertion
      await connection.query<any>({ sql: query, timeout: 120000 });
      connection.release();
      logger.info('Import completed');
    } catch (e) {
      connection.release();
      logger.info(`Unable to import pools in the database!`);
      throw e;
    }
  }

}

export default new PoolsParser();