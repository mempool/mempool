// Setup that runs BEFORE setupFiles
// This ensures MEMPOOL_CONFIG_FILE is set before any modules are loaded
import * as path from 'path';
import { execSync } from 'child_process';

// Set the config file path if not already set
if (!process.env.MEMPOOL_CONFIG_FILE) {
  process.env.MEMPOOL_CONFIG_FILE = path.join(__dirname, 'mempool-config.test.json');
}

// Helper to get docker compose command (v1 or v2)
function getDockerComposeCmd(): string {
  try {
    execSync('docker compose version', { stdio: 'pipe' });
    return 'docker compose';
  } catch {
    try {
      execSync('docker-compose version', { stdio: 'pipe' });
      return 'docker-compose';
    } catch {
      throw new Error('Neither "docker compose" nor "docker-compose" is available');
    }
  }
}

// Start the Docker test database container
module.exports = async () => {
  // Skip if SKIP_DB_SETUP is set (e.g., when test-with-db.sh manages the database)
  if (process.env.SKIP_DB_SETUP) {
    console.log('Skipping database setup (managed externally)');
    return;
  }

  console.log('Starting test database container...');
  try {
    const composeFile = path.join(__dirname, 'docker-compose.test.yml');
    const dockerComposeCmd = getDockerComposeCmd();
    
    // Start the container
    execSync(`${dockerComposeCmd} -f "${composeFile}" up -d`, { 
      stdio: 'inherit',
      cwd: __dirname
    });
    
    // Wait for database to be ready
    console.log('Waiting for database to be ready...');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        execSync(`${dockerComposeCmd} -f "${composeFile}" exec -T db-test mysqladmin ping -h localhost -u mempool_test -pmempool_test --silent`, {
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

