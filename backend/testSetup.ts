jest.mock('./mempool-config.json', () => ({}), { virtual: true });
jest.mock('./src/logger.ts', () => ({
  emerg: jest.fn(),
  alert: jest.fn(),
  crit: jest.fn(),
  err: jest.fn(),
  warn: jest.fn(),
  notice: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  updateNetwork: jest.fn(),
  tags: {
    mining: 'mining',
    ln: 'ln',
    goggles: 'goggles',
  },
}), { virtual: true });
jest.mock('./src/api/rbf-cache.ts', () => ({}), { virtual: true });
jest.mock('./src/api/mempool.ts', () => ({}), { virtual: true });
jest.mock('./src/api/memory-cache.ts', () => ({}), { virtual: true });
