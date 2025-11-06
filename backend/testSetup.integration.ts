// Integration test setup - uses real implementations, not mocks
// 
// Note: We don't mock ./mempool-config.json here because:
// 1. The MEMPOOL_CONFIG_FILE env var points to mempool-config.test.json
// 2. config.ts will load that file via require() if env var is set
// 3. If we mock it, we interfere with the actual config loading
//
// Don't mock these for integration tests - we want real implementations:
// - logger.ts (need real logging)
// - config.ts (need real config from mempool-config.test.json)
// - rbf-cache.ts (might be used by repositories)
// - mempool.ts (might be used by repositories)
// - memory-cache.ts (might be used by repositories)

