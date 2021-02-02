"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDbConnection = exports.DB = void 0;
const config_1 = require("./config");
const promise_1 = require("mysql2/promise");
const logger_1 = require("./logger");
class DB {
}
exports.DB = DB;
DB.pool = promise_1.createPool({
    host: config_1.default.DATABASE.HOST,
    port: config_1.default.DATABASE.PORT,
    database: config_1.default.DATABASE.DATABASE,
    user: config_1.default.DATABASE.USERNAME,
    password: config_1.default.DATABASE.PASSWORD,
    connectionLimit: 10,
    supportBigNumbers: true,
});
async function checkDbConnection() {
    try {
        const connection = await DB.pool.getConnection();
        logger_1.default.info('Database connection established.');
        connection.release();
    }
    catch (e) {
        logger_1.default.err('Could not connect to database: ' + e.message || e);
        process.exit(1);
    }
}
exports.checkDbConnection = checkDbConnection;
