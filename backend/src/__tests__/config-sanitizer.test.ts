import { validateConfig, ConfigValidationError } from '../config-sanitizer';

function validConfig() {
  return {
    MEMPOOL: { NETWORK: 'mainnet' },
    LIGHTNING: { ENABLED: false },
    DATABASE: { ENABLED: true },
    MEMPOOL_SERVICES: { ACCELERATIONS: false },
  };
}

describe('config-sanitizer', () => {
  test('does not throw when config is valid', () => {
    expect(() => validateConfig(validConfig())).not.toThrow();
  });

  test('throws ConfigValidationError when LIGHTNING.ENABLED is true and DATABASE.ENABLED is false', () => {
    expect(() =>
      validateConfig({
        ...validConfig(),
        LIGHTNING: { ENABLED: true },
        DATABASE: { ENABLED: false },
      })
    ).toThrow(ConfigValidationError);

    try {
      validateConfig({
        ...validConfig(),
        LIGHTNING: { ENABLED: true },
        DATABASE: { ENABLED: false },
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).messages).toHaveLength(1);
      expect((e as ConfigValidationError).messages[0]).toContain('config.LIGHTNING.ENABLED');
      expect((e as ConfigValidationError).messages[0]).toContain('config.DATABASE.ENABLED');
    }
  });

  test('throws ConfigValidationError when ACCELERATIONS is true and NETWORK is not mainnet', () => {
    expect(() =>
      validateConfig({
        ...validConfig(),
        MEMPOOL: { NETWORK: 'testnet' },
        MEMPOOL_SERVICES: { ACCELERATIONS: true },
      })
    ).toThrow(ConfigValidationError);

    try {
      validateConfig({
        ...validConfig(),
        MEMPOOL: { NETWORK: 'testnet' },
        MEMPOOL_SERVICES: { ACCELERATIONS: true },
      });
    } catch (e) {
      expect((e as ConfigValidationError).messages[0]).toContain('config.MEMPOOL_SERVICES.ACCELERATIONS');
      expect((e as ConfigValidationError).messages[0]).toContain("config.MEMPOOL.NETWORK: 'testnet'");
    }
  });

  test('reports all errors when multiple invalid combinations are present', () => {
    let thrown: ConfigValidationError;
    try {
      validateConfig({
        MEMPOOL: { NETWORK: 'signet' },
        LIGHTNING: { ENABLED: true },
        DATABASE: { ENABLED: false },
        MEMPOOL_SERVICES: { ACCELERATIONS: true },
      });
    } catch (e) {
      thrown = e as ConfigValidationError;
    }
    expect(thrown!).toBeInstanceOf(ConfigValidationError);
    expect(thrown!.messages).toHaveLength(2);
    const joined = thrown!.messages.join(' ');
    expect(joined).toContain('LIGHTNING.ENABLED');
    expect(joined).toContain('DATABASE.ENABLED');
    expect(joined).toContain('ACCELERATIONS');
    expect(joined).toContain('signet');
  });
});
