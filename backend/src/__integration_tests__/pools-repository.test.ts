import PoolsRepository from '../repositories/PoolsRepository';
import { setupTestDatabase, waitForDatabase, cleanupTestData, insertTestPool } from './test-helpers';

describe('PoolsRepository Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('should insert and retrieve a pool', async () => {
    const poolData = {
      name: 'Foundry USA',
      slug: 'foundryusa',
      link: 'https://foundrydigital.com',
      addresses: JSON.stringify(['bc1qxhmdufsvnuaaaer4ynz88fspdsxq2h9e9cetdj']),
      regexes: JSON.stringify(['/Foundry USA Pool/'])
    };

    const poolId = await insertTestPool(poolData);
    expect(poolId).toBeGreaterThan(0);

    const pools = await PoolsRepository.$getPools();
    const insertedPool = pools.find(p => p.id === poolId);

    expect(insertedPool).toBeDefined();
    expect(insertedPool?.name).toBe(poolData.name);
    expect(insertedPool?.slug).toBe(poolData.slug);
  });

  test('should get pool by slug', async () => {
    await insertTestPool({
      name: 'AntPool',
      slug: 'antpool',
      link: 'https://antpool.com'
    });

    const pool = await PoolsRepository.$getPool('antpool');
    
    expect(pool).toBeDefined();
    expect(pool!.name).toBe('AntPool');
    expect(pool!.slug).toBe('antpool');
  });

  test('should get all pools', async () => {
    await insertTestPool({
      name: 'Pool 1',
      slug: 'pool-1'
    });
    await insertTestPool({
      name: 'Pool 2',
      slug: 'pool-2'
    });
    await insertTestPool({
      name: 'Pool 3',
      slug: 'pool-3'
    });

    const pools = await PoolsRepository.$getPools();
    
    expect(pools.length).toBeGreaterThanOrEqual(3);
  });

  test('should handle pool with addresses', async () => {
    const addresses = ['bc1qtest1', 'bc1qtest2', '3TestAddress'];
    await insertTestPool({
      name: 'Multi Address Pool',
      slug: 'multi-address-pool',
      addresses: JSON.stringify(addresses)
    });

    const pool = await PoolsRepository.$getPool('multi-address-pool', false);
    
    expect(pool).toBeDefined();
    const poolAddresses = JSON.parse(pool!.addresses);
    expect(poolAddresses).toHaveLength(3);
    expect(poolAddresses).toContain('bc1qtest1');
  });

  test('should handle pool with regexes', async () => {
    const regexes = ['/Pool Name/', '/Alternative Name/'];
    await insertTestPool({
      name: 'Regex Pool',
      slug: 'regex-pool',
      regexes: JSON.stringify(regexes)
    });

    const pool = await PoolsRepository.$getPool('regex-pool', false);
    
    expect(pool).toBeDefined();
    const poolRegexes = JSON.parse(pool!.regexes);
    expect(poolRegexes).toHaveLength(2);
    expect(poolRegexes[0]).toBe('/Pool Name/');
  });

  test('should handle non-existent pool', async () => {
    const pool = await PoolsRepository.$getPool('non-existent-pool-slug');
    expect(pool).toBeNull();
  });

  test('should update pool information', async () => {
    const poolDbId = await insertTestPool({
      name: 'Original Pool Name',
      slug: 'original-pool'
    });

    // Update the pool name
    await PoolsRepository.$renameMiningPool(poolDbId, 'updated-pool', 'Updated Pool Name');

    const pool = await PoolsRepository.$getPool('updated-pool');
    expect(pool).toBeDefined();
    expect(pool!.name).toBe('Updated Pool Name');
  });
});

