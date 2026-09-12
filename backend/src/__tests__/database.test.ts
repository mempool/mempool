import config from '../config';

jest.mock('mysql2/promise', () => {
  const state = { log: [] as string[], connections: 0 };
  const record = (who: string, sql: any): void => { state.log.push(`${who}: ${typeof sql === 'string' ? sql : sql.sql}`); };
  const fakeConnection = (name: string) => ({
    query: jest.fn(async (sql) => { record(name, sql); return [[], []]; }),
    beginTransaction: jest.fn(async () => { state.log.push(`${name}: begin`); }),
    commit: jest.fn(async () => { state.log.push(`${name}: commit`); }),
    rollback: jest.fn(async () => { state.log.push(`${name}: rollback`); }),
    release: jest.fn(() => { state.log.push(`${name}: release`); }),
  });
  return {
    __state: state,
    createPool: () => ({
      on: jest.fn(),
      query: jest.fn(async (sql) => { record('pool', sql); return [[], []]; }),
      getConnection: jest.fn(async () => fakeConnection(`conn${++state.connections}`)),
    }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __state: state } = require('mysql2/promise');
import DB from '../database';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1));

describe('DB.$transaction', () => {
  beforeAll(() => {
    config.DATABASE.ENABLED = true;
  });
  beforeEach(() => {
    state.log.length = 0;
  });

  test('queries outside a transaction go to the pool', async () => {
    await DB.query('SELECT 1');
    expect(state.log).toEqual(['pool: SELECT 1']);
  });

  test('every query issued while the callback runs uses the transaction connection, then commits', async () => {
    const deep = async (): Promise<void> => {
      await tick();
      await DB.query('UPDATE a');
      await DB.query({ sql: 'UPDATE b', timeout: 1000 });
    };
    const result = await DB.$transaction(async () => {
      await DB.query('DELETE FROM x');
      await deep();
      return 'done';
    });
    expect(result).toEqual('done');
    expect(state.log).toEqual([
      'conn1: begin',
      'conn1: DELETE FROM x',
      'conn1: UPDATE a',
      'conn1: UPDATE b',
      'conn1: commit',
      'conn1: release',
    ]);
  });

  test('a concurrent query started outside the transaction does not join it', async () => {
    let releaseTransaction: () => void = () => {};
    const gate = new Promise<void>((resolve) => { releaseTransaction = resolve; });
    const transaction = DB.$transaction(async () => {
      await DB.query('UPDATE inside');
      await gate;
    });
    await tick();
    await DB.query('SELECT outside');
    releaseTransaction();
    await transaction;
    expect(state.log).toEqual([
      'conn2: begin',
      'conn2: UPDATE inside',
      'pool: SELECT outside',
      'conn2: commit',
      'conn2: release',
    ]);
  });

  test('an exception rolls back, releases, and propagates', async () => {
    await expect(DB.$transaction(async () => {
      await DB.query('UPDATE y');
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(state.log).toEqual(['conn3: begin', 'conn3: UPDATE y', 'conn3: rollback', 'conn3: release']);
  });

  test('a nested transaction and $atomicQuery join the enclosing one', async () => {
    await DB.$transaction(async () => {
      await DB.$transaction(async () => {
        await DB.query('UPDATE nested');
      });
      await DB.$atomicQuery([{ query: 'INSERT 1', params: [] }, { query: 'INSERT 2', params: [] }]);
    });
    expect(state.log).toEqual([
      'conn4: begin',
      'conn4: UPDATE nested',
      'conn4: INSERT 1',
      'conn4: INSERT 2',
      'conn4: commit',
      'conn4: release',
    ]);
  });
});
