/**
 * db_config.js
 * 数据库连接池配置 (MySQL / mysql2/promise)
 * 强制使用 Prepared Statements 预处理语句，防止 SQL 注入
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建 MySQL 连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'tuition_center_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  timezone: '+08:00',
  dateStrings: true
});

/**
 * 通用预处理语句查询执行器 (Prepared Statement Executor)
 * @param {string} sql带有占位符 ? 的 SQL 预处理语句
 * @param {Array} params 绑定参数数组
 * @returns {Promise<[Array, Array]>} [rows, fields]
 */
async function queryPrepared(sql, params = []) {
  try {
    const [rows, fields] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('MySQL Prepared Query Error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * 带有事务支持的执行函数
 * @param {Function} callback 包含 connection 参数的异步回调
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  queryPrepared,
  withTransaction
};
