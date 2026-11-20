// Postgres. Production uses DATABASE_URL (e.g. Neon); tests and local dev use PGlite, a real Postgres
// that runs inside Node (in memory, or in a folder). Queries keep the `prepare(sql).run/get/all` shape with
// `?` placeholders; every call is async.
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    pw_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    settings TEXT NOT NULL DEFAULT '{}',
    fails INTEGER NOT NULL DEFAULT 0,
    locked_until BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS codes (
    email TEXT NOT NULL,
    purpose TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (email, purpose)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires BIGINT NOT NULL,
    created_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trips (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    start BIGINT NOT NULL,
    "end" BIGINT NOT NULL,
    mode TEXT NOT NULL,
    distance_m DOUBLE PRECISION NOT NULL DEFAULT 0,
    steps INTEGER NOT NULL DEFAULT 0,
    max_speed DOUBLE PRECISION NOT NULL DEFAULT 0,
    points TEXT NOT NULL DEFAULT '[]',
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id)
  );
  CREATE INDEX IF NOT EXISTS trips_by_time ON trips(user_id, start);
  CREATE INDEX IF NOT EXISTS trips_by_update ON trips(user_id, updated_at);
  ALTER TABLE trips ADD COLUMN IF NOT EXISTS extra TEXT NOT NULL DEFAULT '{}';
`;

// BIGINT (millisecond times) comes back as a JS number, not a string.
pg.types.setTypeParser(20, (v) => Number(v));

const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => '$' + ++i); };
const wrap = (query) => ({
  prepare(sql) {
    const text = toPg(sql);
    return {
      run: (...a) => query(text, a),
      get: async (...a) => (await query(text, a)).rows[0],
      all: async (...a) => (await query(text, a)).rows
    };
  },
  exec: (sql) => query(sql)
});

// `url`: a postgres:// URL, a folder for PGlite, or omitted/':memory:' for an in-memory database.
export async function openDb(url) {
  let db;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const pool = new pg.Pool({ connectionString: url, max: 5, ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
    db = wrap((text, params) => pool.query(text, params));
    db.tx = async (fn) => {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const r = await fn(wrap((t, p) => c.query(t, p))); await c.query('COMMIT'); return r; }
      catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
      finally { c.release(); }
    };
    db.close = () => pool.end();
    await pool.query(SCHEMA);
  } else {
    const lite = new PGlite(url && url !== ':memory:' ? url : undefined, { parsers: { 20: (v) => Number(v) } });
    db = wrap((text, params) => (params && params.length ? lite.query(text, params) : lite.exec(text).then((r) => r[r.length - 1] || { rows: [] })));
    db.tx = (fn) => lite.transaction((tx) => fn(wrap((t, p) => tx.query(t, p))));
    db.close = () => lite.close();
    await lite.exec(SCHEMA);
  }
  return db;
}
