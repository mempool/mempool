/**
 * Validates backend configuration at startup.
 * Prevents invalid combinations of settings; throws on error so the caller
 * can log and exit. Keeps this module side-effect free and easy to test.
 * @see https://github.com/mempool/mempool/issues/4141
 */

interface ConfigForSanitizer {
  MEMPOOL: { NETWORK: string };
  LIGHTNING: { ENABLED: boolean };
  DATABASE: { ENABLED: boolean };
  MEMPOOL_SERVICES: { ACCELERATIONS: boolean };
}

function collectErrors(config: ConfigForSanitizer): string[] {
  const errors: string[] = [];

  if (config.LIGHTNING.ENABLED === true && config.DATABASE.ENABLED === false) {
    errors.push(
      `"config.LIGHTNING.ENABLED: true" cannot be used alongside "config.DATABASE.ENABLED: false", please fix your configuration and try again`
    );
  }

  if (config.MEMPOOL_SERVICES.ACCELERATIONS === true && config.MEMPOOL.NETWORK !== 'mainnet') {
    errors.push(
      `"config.MEMPOOL_SERVICES.ACCELERATIONS: true" cannot be used alongside "config.MEMPOOL.NETWORK: '${config.MEMPOOL.NETWORK}'", please fix your configuration and try again`
    );
  }

  return errors;
}

export class ConfigValidationError extends Error {
  readonly messages: string[];

  constructor(messages: string[]) {
    super(messages.join('; '));
    this.name = 'ConfigValidationError';
    this.messages = messages;
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}

/**
 * Validates config. Throws ConfigValidationError with one or more messages if invalid.
 * Caller is responsible for logging and process.exit(1).
 */
export function validateConfig(config: ConfigForSanitizer): void {
  const errors = collectErrors(config);
  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }
}
