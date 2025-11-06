// Setup that runs BEFORE setupFiles
// This ensures MEMPOOL_CONFIG_FILE is set before any modules are loaded
import * as path from 'path';
import { execSync } from 'child_process';

// Set the config file path if not already set
if (!process.env.MEMPOOL_CONFIG_FILE) {
  process.env.MEMPOOL_CONFIG_FILE = path.join(__dirname, 'mempool-config.test.json');
}

// Start the Docker test database container
module.exports = async () => {
  console.log('Starting test database container...');
  try {
    const composeFile = path.join(__dirname, 'docker-compose.test.yml');
    
    // Start the container
    execSync(`docker-compose -f "${composeFile}" up -d`, { 
      stdio: 'inherit',
      cwd: __dirname
    });
    
    // Wait for database to be ready
    console.log('Waiting for database to be ready...');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        execSync(`docker-compose -f "${composeFile}" exec -T db-test mysqladmin ping -h localhost -u mempool_test -pmempool_test --silent`, {
          cwd: __dirname,
          stdio: 'pipe'
        });
        console.log('Database is ready!');
        break;
      } catch (e) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Database did not start in time');
        }
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Failed to start test database:', error instanceof Error ? error.message : error);
    throw error;
  }
};

