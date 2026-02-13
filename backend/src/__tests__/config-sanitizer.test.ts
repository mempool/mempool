import { validateConfig } from '../config-sanitizer';

const exitMock = jest.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);
const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

function validConfig() {
  return {
    MEMPOOL: { NETWORK: 'mainnet' },
    LIGHTNING: { ENABLED: false },
    DATABASE: { ENABLED: true },
    MEMPOOL_SERVICES: { ACCELERATIONS: false },
  };
}

beforeEach(() => {
  exitMock.mockClear();
  consoleErrorMock.mockClear();
});

afterAll(() => {
  exitMock.mockRestore();
  consoleErrorMock.mockRestore();
});

describe('config-sanitizer', () => {
  test('does not exit when config is valid', () => {
    validateConfig(validConfig());
    expect(exitMock).not.toHaveBeenCalled();
  });

  test('exits when LIGHTNING.ENABLED is true and DATABASE.ENABLED is false', () => {
    validateConfig({
      ...validConfig(),
      LIGHTNING: { ENABLED: true },
      DATABASE: { ENABLED: false },
    });
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(consoleErrorMock).toHaveBeenCalled();
    const output = consoleErrorMock.mock.calls.flat(1).join(' ');
    expect(output).toContain('config.LIGHTNING.ENABLED');
    expect(output).toContain('config.DATABASE.ENABLED');
  });

  test('exits when ACCELERATIONS is true and NETWORK is not mainnet', () => {
    validateConfig({
      ...validConfig(),
      MEMPOOL: { NETWORK: 'testnet' },
      MEMPOOL_SERVICES: { ACCELERATIONS: true },
    });
    expect(exitMock).toHaveBeenCalledWith(1);
    const output = consoleErrorMock.mock.calls.flat(1).join(' ');
    expect(output).toContain('config.MEMPOOL_SERVICES.ACCELERATIONS');
    expect(output).toContain("config.MEMPOOL.NETWORK: 'testnet'");
  });

  test('reports all errors when multiple invalid combinations are present', () => {
    validateConfig({
      MEMPOOL: { NETWORK: 'signet' },
      LIGHTNING: { ENABLED: true },
      DATABASE: { ENABLED: false },
      MEMPOOL_SERVICES: { ACCELERATIONS: true },
    });
    expect(exitMock).toHaveBeenCalledWith(1);
    const output = consoleErrorMock.mock.calls.flat(1).join(' ');
    expect(output).toContain('LIGHTNING.ENABLED');
    expect(output).toContain('DATABASE.ENABLED');
    expect(output).toContain('ACCELERATIONS');
    expect(output).toContain('signet');
  });
});
