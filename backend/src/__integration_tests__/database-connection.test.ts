import DB from '../database';
import config from '../config';
import { setupTestDatabase, waitForDatabase, getTestDatabaseConfig } from './test-helpers';

describe('Database Connection Integration Tests', () => {
  beforeAll(async () => {
    // Wait for database to be ready
    await waitForDatabase();
  }, 60000);

  test('should connect to the test database', async () => {
    const dbConfig = getTestDatabaseConfig();
    expect(dbConfig.enabled).toBe(true);
    expect(dbConfig.database).toBe('mempool_test');
    expect(dbConfig.port).toBe(33306);
  });

  test('should execute a simple query', async () => {
    const [result] = await DB.query<any>('SELECT 1 as value');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(1);
  });

  test('should execute a query with parameters', async () => {
    const [result] = await DB.query<any>('SELECT ? as sum', [42]);
    expect(result).toHaveLength(1);
    expect(result[0].sum).toBe(42);
  });

  test('should check database connection', async () => {
    await expect(DB.checkDbConnection()).resolves.not.toThrow();
  });

  test('should handle query timeout configuration', async () => {
    expect(config.DATABASE.TIMEOUT).toBeGreaterThan(0);
  });

  test('should have correct database configuration', () => {
    expect(config.DATABASE.HOST).toBe('127.0.0.1');
    expect(config.DATABASE.USERNAME).toBe('mempool_test');
    expect(config.DATABASE.PASSWORD).toBe('mempool_test');
    expect(config.DATABASE.DATABASE).toBe('mempool_test');
  });
});

