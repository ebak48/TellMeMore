'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// TellMeMore — DB Migration Runner
// Node.js 22 built-in sqlite only. Zero npm deps.
// Run: node tellmemore-migrations.js
// Or: imported and called from server on startup.
// ─────────────────────────────────────────────────────────────────────────────

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs   = require('node:fs');

const DB_PATH = process.env.DB_PATH
  || path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data', 'tellmemore.db');

function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec('PRAGMA foreign_keys=ON;');
  db.exec('PRAGMA busy_timeout=5000;');

  // Bootstrap schema_version if missing (safe on existing DB)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  runMigrations(db);
  return db;
}

// ─── MIGRATIONS ──────────────────────────────────────────────────────────────
// Each migration is append-only. Never modify an existing one.
// All DDL inside a migration must be idempotent (IF NOT EXISTS).

const MIGRATIONS = [

  // ── v1: core schema ────────────────────────────────────────────────────────
  {
    version: 1,
    name: 'core_schema',
    up(db) {
      // ── Legacy schema upgrade ──────────────────────────────────────────
      // If tables exist from an earlier deployment with a different schema,
      // add any missing columns before CREATE TABLE IF NOT EXISTS (which
      // silently skips existing tables) and CREATE INDEX.
      function hasColumn(table, column) {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all();
        return cols.some(c => c.name === column);
      }
      function hasTable(table) {
        const row = db.prepare(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?"
        ).get(table);
        return row.n > 0;
      }
      function addColumnIfMissing(table, column, definition) {
        if (hasTable(table) && !hasColumn(table, column)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
        }
      }

      // profiles: old schema may lack user_id, share_id, context, language
      addColumnIfMissing('profiles', 'user_id',    "TEXT");
      addColumnIfMissing('profiles', 'share_id',   "TEXT");
      addColumnIfMissing('profiles', 'name',       "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing('profiles', 'mode',       "TEXT NOT NULL DEFAULT 'friends'");
      addColumnIfMissing('profiles', 'context',    "TEXT");
      addColumnIfMissing('profiles', 'language',   "TEXT DEFAULT 'en'");
      addColumnIfMissing('profiles', 'created_at', "INTEGER NOT NULL DEFAULT 0");

      // responses: old schema may lack session_id, ref_profile_id, src, ip_hash, hidden, reported
      addColumnIfMissing('responses', 'profile_id',     "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing('responses', 'session_id',     "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing('responses', 'answers',        "TEXT NOT NULL DEFAULT '{}'");
      addColumnIfMissing('responses', 'ref_profile_id', "TEXT");
      addColumnIfMissing('responses', 'src',            "TEXT");
      addColumnIfMissing('responses', 'ip_hash',        "TEXT");
      addColumnIfMissing('responses', 'hidden',         "INTEGER DEFAULT 0");
      addColumnIfMissing('responses', 'reported',       "INTEGER DEFAULT 0");
      addColumnIfMissing('responses', 'created_at',     "INTEGER NOT NULL DEFAULT 0");

      // Backfill NULL share_id values for any legacy profile rows
      if (hasTable('profiles') && hasColumn('profiles', 'share_id')) {
        const crypto = require('node:crypto');
        const rows = db.prepare("SELECT id FROM profiles WHERE share_id IS NULL").all();
        const stmt = db.prepare("UPDATE profiles SET share_id = ? WHERE id = ?");
        for (const row of rows) {
          stmt.run(crypto.randomBytes(6).toString('hex'), row.id);
        }
      }

      db.exec(`
        -- Profile owners (email-based identity, no password)
        CREATE TABLE IF NOT EXISTS users (
          id         TEXT    PRIMARY KEY,
          email      TEXT    UNIQUE NOT NULL,
          created_at INTEGER NOT NULL
        );

        -- One-time magic login tokens
        CREATE TABLE IF NOT EXISTS magic_tokens (
          token      TEXT    PRIMARY KEY,
          user_id    TEXT    NOT NULL,
          profile_id TEXT,
          expires_at INTEGER NOT NULL,
          used       INTEGER DEFAULT 0
        );

        -- Owner browser sessions (cookie-based, no password)
        CREATE TABLE IF NOT EXISTS owner_sessions (
          token      TEXT    PRIMARY KEY,
          user_id    TEXT    NOT NULL,
          profile_id TEXT    NOT NULL,
          expires_at INTEGER NOT NULL
        );

        -- Perception profiles
        CREATE TABLE IF NOT EXISTS profiles (
          id         TEXT    PRIMARY KEY,
          user_id    TEXT,
          slug       TEXT    UNIQUE NOT NULL,
          share_id   TEXT    UNIQUE NOT NULL,
          name       TEXT    NOT NULL,
          mode       TEXT    NOT NULL DEFAULT 'friends',
          context    TEXT,
          language   TEXT    DEFAULT 'en',
          created_at INTEGER NOT NULL
        );

        -- Anonymous responses from responders
        CREATE TABLE IF NOT EXISTS responses (
          id              TEXT    PRIMARY KEY,
          profile_id      TEXT    NOT NULL,
          session_id      TEXT    NOT NULL,
          answers         TEXT    NOT NULL,
          ref_profile_id  TEXT,
          src             TEXT,
          ip_hash         TEXT,
          hidden          INTEGER DEFAULT 0,
          reported        INTEGER DEFAULT 0,
          created_at      INTEGER NOT NULL
        );

        -- Minimal analytics events (no PII)
        CREATE TABLE IF NOT EXISTS analytics (
          id         TEXT    PRIMARY KEY,
          event      TEXT    NOT NULL,
          profile_id TEXT,
          session_id TEXT,
          user_id    TEXT,
          language   TEXT,
          platform   TEXT,
          metadata   TEXT,
          created_at INTEGER NOT NULL
        );

        -- Referral / attribution log
        CREATE TABLE IF NOT EXISTS referrals (
          id                  TEXT    PRIMARY KEY,
          share_id            TEXT    NOT NULL,
          referrer_profile_id TEXT    NOT NULL,
          responder_session   TEXT,
          invited_profile_id  TEXT,
          src                 TEXT,
          converted           INTEGER DEFAULT 0,
          created_at          INTEGER NOT NULL
        );

        -- Reports from owners on harmful responses
        CREATE TABLE IF NOT EXISTS reports (
          id               TEXT    PRIMARY KEY,
          response_id      TEXT    NOT NULL,
          reporter_session TEXT,
          reason           TEXT,
          resolved         INTEGER DEFAULT 0,
          created_at       INTEGER NOT NULL
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_profiles_slug     ON profiles(slug);
        CREATE INDEX IF NOT EXISTS idx_profiles_share_id ON profiles(share_id);
        CREATE INDEX IF NOT EXISTS idx_profiles_user_id  ON profiles(user_id);
        CREATE INDEX IF NOT EXISTS idx_responses_profile ON responses(profile_id);
        CREATE INDEX IF NOT EXISTS idx_responses_hidden  ON responses(profile_id, hidden);
        CREATE INDEX IF NOT EXISTS idx_analytics_event   ON analytics(event);
        CREATE INDEX IF NOT EXISTS idx_referrals_share   ON referrals(share_id);
        CREATE INDEX IF NOT EXISTS idx_magic_user        ON magic_tokens(user_id);
      `);
    }
  },

  // ── v2: add question_bank_version to profiles ──────────────────────────────
  {
    version: 2,
    name: 'profile_question_version',
    up(db) {
      db.exec(`
        ALTER TABLE profiles ADD COLUMN question_version TEXT DEFAULT 'v1';
      `);
    }
  },

  // ── v3: add invited_profile_id to referrals + share_after_result support ──
  // safe: ALTER TABLE ADD COLUMN is non-destructive in SQLite
  {
    version: 3,
    name: 'referrals_invited_profile_id',
    up(db) {
      try {
        db.exec(`ALTER TABLE referrals ADD COLUMN invited_profile_id TEXT;`);
      } catch(e) {
        if (!e.message.includes('duplicate column')) throw e;
      }
    }
  }

];

function runMigrations(db) {
  const row = db.prepare('SELECT COALESCE(MAX(version),0) AS v FROM schema_version').get();
  const current = row.v;

  let applied = 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    console.log(`[DB] Applying migration ${m.version}: ${m.name}`);
    m.up(db);
    db.prepare(
      'INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)'
    ).run(m.version, m.name, Date.now());
    applied++;
  }

  const latest = MIGRATIONS[MIGRATIONS.length - 1].version;
  if (applied) console.log(`[DB] Applied ${applied} migration(s) — now at v${latest}`);
  else         console.log(`[DB] Schema up to date (v${latest})`);
}

module.exports = { initDb, DB_PATH };

// Allow: node tellmemore-migrations.js
if (require.main === module) {
  initDb();
  console.log('[DB] Done.');
}
