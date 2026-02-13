/**
 * Demo: run the config sanitizer for both valid and invalid config (no full backend build required).
 * From backend/: npx ts-node scripts/run-sanitizer-demo.ts
 */
import { validateConfig, ConfigValidationError } from '../src/config-sanitizer';

const validConfig = {
  MEMPOOL: { NETWORK: 'mainnet' as const },
  LIGHTNING: { ENABLED: false },
  DATABASE: { ENABLED: true },
  MEMPOOL_SERVICES: { ACCELERATIONS: false },
};

const invalidConfig = {
  MEMPOOL: { NETWORK: 'testnet' as const },
  LIGHTNING: { ENABLED: true },
  DATABASE: { ENABLED: false },
  MEMPOOL_SERVICES: { ACCELERATIONS: true },
};

console.log('1) Valid config (Lightning off, DB on, mainnet, no accelerations):');
try {
  validateConfig(validConfig);
  console.log('   OK – no errors, sanitizer allows startup.\n');
} catch (err) {
  console.log('   FAIL – unexpected error:', err);
  process.exit(1);
}

console.log('2) Invalid config (Lightning+no DB, Accelerations+testnet):');
try {
  validateConfig(invalidConfig);
  console.log('   FAIL – expected ConfigValidationError, but none was thrown.');
  process.exit(1);
} catch (err) {
  if (err instanceof ConfigValidationError) {
    console.error('[config sanitizer] Invalid configuration:\n');
    err.messages.forEach((msg) => console.error(`  - ${msg}`));
    console.error('\n   OK – sanitizer rejected config and threw ConfigValidationError (backend would exit 1).');
    process.exit(1);
  }
  throw err;
}
