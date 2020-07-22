const config = require('../mempool-config.json');
import { createPool } from 'mysql2/promise';

export class DB {
  static pool = createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_DATABASE,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    connectionLimit: 10,
    supportBigNumbers: true,
  });
}

export async function checkDbConnection() {
  try {
    const connection = await DB.pool.getConnection();
    console.log('Database connection established.');
    connection.release();
  } catch (e) {
    console.log('Could not connect to database.');
    console.log(e);
    process.exit(1);
  }
}
