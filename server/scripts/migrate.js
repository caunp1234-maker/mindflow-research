// server/migrations/*.sql를 파일명 순서대로, 아직 적용 안 된 것만 실행한다.
// 실행: npm run migrate (server/.env의 DATABASE_URL을 사용)

const fs = require('fs');
const path = require('path');
const db = require('../src/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function main() {
  await db.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const { rows: applied } = await db.query('select filename from schema_migrations');
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`skip (already applied): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`applying: ${file}`);
    await db.withTransaction(async (client) => {
      await client.query(sql);
      await client.query('insert into schema_migrations (filename) values ($1)', [file]);
    });
  }

  console.log('migration 완료');
  await db.pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
