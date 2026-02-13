/**
 * Validates backend configuration at startup.
 * Prevents invalid combinations of settings and exits with a clear message
 * so operators can fix their mempool-config.json.
 * @see https://github.com/mempool/mempool/issues/4141
 */

interface ConfigForSanitizer {
  MEMPOOL: { NETWORK: string };
  LIGHTNING: { ENABLED: boolean };
  DATABASE: { ENABLED: boolean };
  MEMPOOL_SERVICES: { ACCELERATIONS: boolean };
}

interface ValidationError {
  message: string;
}

function collectErrors(config: ConfigForSanitizer): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.LIGHTNING.ENABLED === true && config.DATABASE.ENABLED === false) {
    errors.push({
      message: `"config.LIGHTNING.ENABLED: true" cannot be used alongside "config.DATABASE.ENABLED: false", please fix your configuration and try again`,
    });
  }

  if (config.MEMPOOL_SERVICES.ACCELERATIONS === true && config.MEMPOOL.NETWORK !== 'mainnet') {
    errors.push({
      message: `"config.MEMPOOL_SERVICES.ACCELERATIONS: true" cannot be used alongside "config.MEMPOOL.NETWORK: '${config.MEMPOOL.NETWORK}'", please fix your configuration and try again`,
    });
  }

  return errors;
}

export function validateConfig(config: ConfigForSanitizer): void {
  const errors = collectErrors(config);
  if (errors.length === 0) {
    return;
  }
  console.error('\n[config sanitizer] Invalid configuration:\n');
  errors.forEach((err) => {
    console.error(`  - ${err.message}`);
  });
  console.error('\n');
  process.exit(1);
}
