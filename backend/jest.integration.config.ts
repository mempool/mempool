import type { Config } from "@jest/types"

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  automock: false,
  collectCoverage: false,
  coverageProvider: "v8",
  testMatch: [
    "**/__integration_tests__/**/*.test.ts"
  ],
  globalSetup: "./jest.integration.setup.ts",  // Start database before all tests
  setupFiles: [
    "./testSetup.integration.ts",
  ],
  globalTeardown: "./jest.integration.teardown.ts",  // Stop database after all tests
  maxWorkers: 1,  // Force sequential execution
}
export default config;

