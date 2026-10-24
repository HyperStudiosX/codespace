const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const DATA_DIR = path.join(process.cwd(), '.data');
const JSON_PATH = path.join(DATA_DIR, 'store.json');
let pool = null;
let mode = 'json';
let json = { guilds: {}, tickets: {}, automod: {}, customRoles: {}, tempVoice: {} };

function ensureJson() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(JSON_PATH)) {
    try { json = { ...json, ...JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) }; }
    catch (e) { console.error('[DB] Could not parse .data/store.json:', e.message); }
  }
}
function saveJson() { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(JSON_PATH, JSON.stringify(json, null, 2)); }
function hasPgConfig() { return Boolean(process.env.DATABASE_URL || process.env.PGHOST); }
async function init() {
  if (!hasPgConfig()) { ensureJson(); mode = 'json'; console.log('[DB] No PostgreSQL settings found; using built-in JSON storage.'); return; }
  pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined } : {
    host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE,
    user: process.env.PGUSER, password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS hypercore_settings (guild_id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hypercore_tickets (id BIGSERIAL PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  mode = 'postgres'; console.log('[DB] PostgreSQL connected.');
}
async function getGuild(guildId) {
  if (mode === 'postgres') { const r = await pool.query('SELECT data FROM hypercore_settings WHERE guild_id=$1', [guildId]); return r.rows[0]?.data || {}; }
  return json.guilds[guildId] || {};
}
async function setGuild(guildId, patch) {
  const current = await getGuild(guildId); const next = { ...current, ...patch };
  if (mode === 'postgres') await pool.query('INSERT INTO hypercore_settings(guild_id,data) VALUES($1,$2::jsonb) ON CONFLICT(guild_id) DO UPDATE SET data=EXCLUDED.data', [guildId, JSON.stringify(next)]);
  else { json.guilds[guildId] = next; saveJson(); }
  return next;
}
async function getAllGuilds() {
  if (mode === 'postgres') { const r = await pool.query('SELECT guild_id,data FROM hypercore_settings'); return Object.fromEntries(r.rows.map(x => [x.guild_id, x.data])); }
  return json.guilds;
}
async function createTicket({ guildId, channelId, userId }) {
  if (mode === 'postgres') { await pool.query('INSERT INTO hypercore_tickets(guild_id,channel_id,user_id) VALUES($1,$2,$3)', [guildId, channelId, userId]); return; }
  json.tickets[channelId] = { guildId, channelId, userId, status: 'open', createdAt: Date.now() }; saveJson();
}
async function getTicket(channelId) {
  if (mode === 'postgres') { const r = await pool.query("SELECT * FROM hypercore_tickets WHERE channel_id=$1 AND status='open' ORDER BY id DESC LIMIT 1", [channelId]); return r.rows[0] || null; }
  return json.tickets[channelId] || null;
}
async function closeTicket(channelId) {
  if (mode === 'postgres') { await pool.query("UPDATE hypercore_tickets SET status='closed' WHERE channel_id=$1 AND status='open'", [channelId]); return; }
  if (json.tickets[channelId]) { json.tickets[channelId].status = 'closed'; saveJson(); }
}
function databaseMode() { return mode; }
module.exports = { init, getGuild, setGuild, getAllGuilds, createTicket, getTicket, closeTicket, databaseMode };
