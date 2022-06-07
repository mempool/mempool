import DB from '../database';
import logger from '../logger';
import config from '../config';

interface Pool {
  name: string;
  link: string;
  regexes: string[];
  addresses: string[];
  slug: string;
}

class PoolsParser {
  miningPools: any[] = [];
  unknownPool: any = {
    'name': "Unknown",
    'link': "https://learnmeabitcoin.com/technical/coinbase-transaction",
    'regexes': "[]",
    'addresses': "[]",
    'slug': 'unknown'
  };
  slugWarnFlag = false;

  /**
   * Parse the pools.json file, consolidate the data and dump it into the database
   */
  public async migratePoolsJson(poolsJson: object) {
    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK) === false) {
      return;
    }

    // First we save every entries without paying attention to pool duplication
    const poolsDuplicated: Pool[] = [];

    logger.debug('Parse coinbase_tags');
    const coinbaseTags = Object.entries(poolsJson['coinbase_tags']);
    for (let i = 0; i < coinbaseTags.length; ++i) {
      poolsDuplicated.push({
        'name': (<Pool>coinbaseTags[i][1]).name,
        'link': (<Pool>coinbaseTags[i][1]).link,
        'regexes': [coinbaseTags[i][0]],
        'addresses': [],
        'slug': ''
      });
    }
    logger.debug('Parse payout_addresses');
    const addressesTags = Object.entries(poolsJson['payout_addresses']);
    for (let i = 0; i < addressesTags.length; ++i) {
      poolsDuplicated.push({
        'name': (<Pool>addressesTags[i][1]).name,
        'link': (<Pool>addressesTags[i][1]).link,
        'regexes': [],
        'addresses': [addressesTags[i][0]],
        'slug': ''
      });
    }

    // Then, we find unique mining pool names
    logger.debug('Identify unique mining pools');
    const poolNames: string[] = [];
    for (let i = 0; i < poolsDuplicated.length; ++i) {
      if (poolNames.indexOf(poolsDuplicated[i].name) === -1) {
        poolNames.push(poolsDuplicated[i].name);
      }
    }
    logger.debug(`Found ${poolNames.length} unique mining pools`);

    // Get existing pools from the db
    let existingPools;
    try {
      if (config.DATABASE.ENABLED === true) {
        [existingPools] = await DB.query({ sql: 'SELECT * FROM pools;', timeout: 120000 });
      } else {
        existingPools = [];
      }
    } catch (e) {
      logger.err('Cannot get existing pools from the database, skipping pools.json import');
      return;
    }

    this.miningPools = [];

    // Finally, we generate the final consolidated pools data
    const finalPoolDataAdd: Pool[] = [];
    const finalPoolDataUpdate: Pool[] = [];
    for (let i = 0; i < poolNames.length; ++i) {
      let allAddresses: string[] = [];
      let allRegexes: string[] = [];
      const match = poolsDuplicated.filter((pool: Pool) => pool.name === poolNames[i]);

      for (let y = 0; y < match.length; ++y) {
        allAddresses = allAddresses.concat(match[y].addresses);
        allRegexes = allRegexes.concat(match[y].regexes);
      }

      const finalPoolName = poolNames[i].replace(`'`, `''`); // To support single quote in names when doing db queries

      let slug: string | undefined;
      try {
        slug = poolsJson['slugs'][poolNames[i]];
      } catch (e) {
        if (this.slugWarnFlag === false) {
          logger.warn(`pools.json does not seem to contain the 'slugs' object`);
          this.slugWarnFlag = true;
        }
      }

      if (slug === undefined) {
        // Only keep alphanumerical
        slug = poolNames[i].replace(/[^a-z0-9]/gi, '').toLowerCase();
        logger.warn(`No slug found for '${poolNames[i]}', generating it => '${slug}'`);
      }

      const poolObj = {
        'name': finalPoolName,
        'link': match[0].link,
        'regexes': allRegexes,
        'addresses': allAddresses,
        'slug': slug
      };

      if (existingPools.find((pool) => pool.name === poolNames[i]) !== undefined) {
        finalPoolDataUpdate.push(poolObj);
      } else {
        logger.debug(`Add '${finalPoolName}' mining pool`);
        finalPoolDataAdd.push(poolObj);
      }

      this.miningPools.push({
        'name': finalPoolName,
        'link': match[0].link,
        'regexes': JSON.stringify(allRegexes),
        'addresses': JSON.stringify(allAddresses),
        'slug': slug
      });
    }

    if (config.DATABASE.ENABLED === false) { // Don't run db operations
      logger.info('Mining pools.json import completed (no database)');
      return;
    }

    logger.debug(`Update pools table now`);

    // Add new mining pools into the database
    let queryAdd: string = 'INSERT INTO pools(name, link, regexes, addresses, slug) VALUES ';
    for (let i = 0; i < finalPoolDataAdd.length; ++i) {
      queryAdd += `('${finalPoolDataAdd[i].name}', '${finalPoolDataAdd[i].link}',
      '${JSON.stringify(finalPoolDataAdd[i].regexes)}', '${JSON.stringify(finalPoolDataAdd[i].addresses)}',
      ${finalPoolDataAdd[i].slug}),`;
    }
    queryAdd = queryAdd.slice(0, -1) + ';';

    // Updated existing mining pools in the database
    const updateQueries: string[] = [];
    for (let i = 0; i < finalPoolDataUpdate.length; ++i) {
      updateQueries.push(`
        UPDATE pools
        SET name='${finalPoolDataUpdate[i].name}', link='${finalPoolDataUpdate[i].link}',
        regexes='${JSON.stringify(finalPoolDataUpdate[i].regexes)}', addresses='${JSON.stringify(finalPoolDataUpdate[i].addresses)}',
        slug='${finalPoolDataUpdate[i].slug}'
        WHERE name='${finalPoolDataUpdate[i].name}'
      ;`);
    }

    try {
      if (finalPoolDataAdd.length > 0) {
        await DB.query({ sql: queryAdd, timeout: 120000 });
      }
      for (const query of updateQueries) {
        await DB.query({ sql: query, timeout: 120000 });
      }
      await this.insertUnknownPool();
      logger.info('Mining pools.json import completed');
    } catch (e) {
      logger.err(`Cannot import pools in the database`);
      throw e;
    }
  }

  /**
   * Manually add the 'unknown pool'
   */
  private async insertUnknownPool() {
    try {
      const [rows]: any[] = await DB.query({ sql: 'SELECT name from pools where name="Unknown"', timeout: 120000 });
      if (rows.length === 0) {
        await DB.query({
          sql: `INSERT INTO pools(name, link, regexes, addresses, slug)
          VALUES("Unknown", "https://learnmeabitcoin.com/technical/coinbase-transaction", "[]", "[]", "unknown");
        `});
      } else {
        await DB.query(`UPDATE pools
          SET name='Unknown', link='https://learnmeabitcoin.com/technical/coinbase-transaction',
          regexes='[]', addresses='[]',
          slug='unknown'
          WHERE name='Unknown'
        `);
      }
    } catch (e) {
      logger.err('Unable to insert "Unknown" mining pool');
    }
  }
}

export default new PoolsParser();
