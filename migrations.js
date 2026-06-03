'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// TellMeMore — Migrations v4
// v4.2 CHANGES:
//   - repairExistingSchema: adds responses.optional_note (TEXT) if missing
//   - Migration v4: explicit optional_note column (LD-06 Option B)
// Safety rules (never break these):
//   - All migrations must be idempotent
//   - Never DROP columns or tables
//   - Never CREATE TABLE for column additions — ALTER TABLE ADD COLUMN only
//   - repairExistingSchema() runs BEFORE version checks — safe on all existing DBs
// ─────────────────────────────────────────────────────────────────────────────
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs   = require('node:fs');

const DB_PATH = process.env.DB_PATH || path.join(
  process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data', 'tellmemore.db'
);

function getColumns(db, table) {
  try { return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name)); }
  catch { return new Set(); }
}
function getTables(db) {
  return new Set(db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name));
}
function addColumn(db, table, column, definition) {
  if (!getColumns(db, table).has(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition.replace(/\bUNIQUE\b/gi,'').trim()}`);
    console.log(`[DB] Repair: added ${table}.${column}`);
    return true;
  }
  return false;
}
function safeCreateIndex(db, name, table, columns) {
  const cols = getColumns(db, table);
  if (columns.split(',').map(c=>c.trim()).every(c=>cols.has(c))) {
    db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${columns})`);
    return true;
  }
  console.log(`[DB] Skipped index ${name}: missing column`);
  return false;
}

// ── repairExistingSchema ──────────────────────────────────────────────────────
// Runs BEFORE migration version checks. Safely adds any missing columns to
// existing production DBs that were created before the formal migration existed.
// CRITICAL: this is what kept Railway from crashing on restarts.
function repairExistingSchema(db) {
  const tables = getTables(db);
  let n = 0;
  if (tables.has('profiles')) {
    if (addColumn(db,'profiles','user_id','TEXT')) n++;
    if (addColumn(db,'profiles','mode',"TEXT DEFAULT 'friends'")) n++;
    if (addColumn(db,'profiles','share_id','TEXT')) n++;
    if (addColumn(db,'profiles','context','TEXT')) n++;
    if (addColumn(db,'profiles','language',"TEXT DEFAULT 'en'")) n++;
    if (addColumn(db,'profiles','question_version',"TEXT DEFAULT 'v1'")) n++;
  }
  if (tables.has('responses')) {
    if (addColumn(db,'responses','ref_profile_id','TEXT')) n++;
    if (addColumn(db,'responses','src','TEXT')) n++;
    if (addColumn(db,'responses','ip_hash','TEXT')) n++;
    if (addColumn(db,'responses','hidden','INTEGER DEFAULT 0')) n++;
    if (addColumn(db,'responses','reported','INTEGER DEFAULT 0')) n++;
    // v4.2: optional_note column (LD-06 Option B — deliberate persistence)
    if (addColumn(db,'responses','optional_note','TEXT')) n++;
  }
  if (tables.has('referrals')) {
    if (addColumn(db,'referrals','invited_profile_id','TEXT')) n++;
  }
  if (n > 0) console.log(`[DB] Schema repair complete — ${n} column(s) added`);
}

// ── MIGRATIONS ────────────────────────────────────────────────────────────────
const MIGRATIONS = [
  { version:1, name:'core_schema', up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS magic_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, profile_id TEXT, expires_at INTEGER NOT NULL, used INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS owner_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, profile_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT, slug TEXT UNIQUE NOT NULL, share_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'friends', context TEXT, language TEXT DEFAULT 'en', question_version TEXT DEFAULT 'v1', created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS responses (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, session_id TEXT NOT NULL, answers TEXT NOT NULL, ref_profile_id TEXT, src TEXT, ip_hash TEXT, hidden INTEGER DEFAULT 0, reported INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS analytics (id TEXT PRIMARY KEY, event TEXT NOT NULL, profile_id TEXT, session_id TEXT, user_id TEXT, language TEXT, platform TEXT, metadata TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS referrals (id TEXT PRIMARY KEY, share_id TEXT NOT NULL, referrer_profile_id TEXT NOT NULL, responder_session TEXT, invited_profile_id TEXT, src TEXT, converted INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, response_id TEXT NOT NULL, reporter_session TEXT, reason TEXT, resolved INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
    `);
    safeCreateIndex(db,'idx_profiles_slug','profiles','slug');
    safeCreateIndex(db,'idx_profiles_share_id','profiles','share_id');
    safeCreateIndex(db,'idx_profiles_user_id','profiles','user_id');
    safeCreateIndex(db,'idx_responses_profile','responses','profile_id');
    safeCreateIndex(db,'idx_responses_hidden','responses','profile_id, hidden');
    safeCreateIndex(db,'idx_analytics_event','analytics','event');
    safeCreateIndex(db,'idx_referrals_share','referrals','share_id');
    safeCreateIndex(db,'idx_magic_user','magic_tokens','user_id');
  }},
  { version:2, name:'profile_question_version', up(db) {
    addColumn(db,'profiles','question_version',"TEXT DEFAULT 'v1'");
  }},
  { version:3, name:'referrals_invited_profile_id', up(db) {
    addColumn(db,'referrals','invited_profile_id','TEXT');
  }},
  // v4.2: optional_note column on responses (LD-06 Option B)
  // Stores responder optional text. Internal only — never shown raw to owner (LD-03).
  // repairExistingSchema also adds this for existing DBs that skip this migration.
  { version:4, name:'responses_optional_note', up(db) {
    addColumn(db,'responses','optional_note','TEXT');
  }}
];

function runMigrations(db) {
  const current = db.prepare('SELECT COALESCE(MAX(version),0) AS v FROM schema_version').get().v;
  let applied = 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    console.log(`[DB] Applying migration ${m.version}: ${m.name}`);
    m.up(db);
    db.prepare('INSERT INTO schema_version (version,name,applied_at) VALUES (?,?,?)').run(m.version, m.name, Date.now());
    applied++;
  }
  const latest = MIGRATIONS[MIGRATIONS.length-1].version;
  if (applied) console.log(`[DB] Applied ${applied} migration(s) — now at v${latest}`);
  else         console.log(`[DB] Schema up to date (v${latest})`);
}

function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive:true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec('PRAGMA foreign_keys=ON;');
  db.exec('PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);`);
  repairExistingSchema(db);
  runMigrations(db);
  return db;
}

module.exports = { initDb, DB_PATH };
if (require.main === module) { initDb(); console.log('[DB] Done.'); }
