const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl });

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  // 트랜잭션이 필요한 라우트(예: 연구 생성 + 방문 정의 일괄 생성)를 위한 헬퍼.
  withTransaction: async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
