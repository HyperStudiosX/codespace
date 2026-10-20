const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "users.json");

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      enabledChannels: [],
      histories: {}
    }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    // Migrate older versions that stored enablement by user ID.
    if (!Array.isArray(data.enabledChannels)) data.enabledChannels = [];
    if (!data.histories || typeof data.histories !== "object") data.histories = {};
    return data;
  } catch {
    return { enabledChannels: [], histories: {} };
  }
}

function writeStore(data) {
  ensureStore();
  const temp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, STATE_FILE);
}

function isEnabled(channelId) {
  return readStore().enabledChannels.includes(channelId);
}

function setEnabled(channelId, enabled) {
  const data = readStore();
  const set = new Set(data.enabledChannels);
  enabled ? set.add(channelId) : set.delete(channelId);
  data.enabledChannels = [...set];
  writeStore(data);
}

function historyKey(channelId, userId) {
  return `${channelId}:${userId}`;
}

function getHistory(channelId, userId, maxMessages) {
  const data = readStore();
  return (data.histories[historyKey(channelId, userId)] || []).slice(-maxMessages);
}

function addHistory(channelId, userId, role, content, maxMessages) {
  const data = readStore();
  const key = historyKey(channelId, userId);
  data.histories[key] ||= [];
  data.histories[key].push({ role, content });
  data.histories[key] = data.histories[key].slice(-maxMessages);
  writeStore(data);
}

function clearHistory(channelId, userId) {
  const data = readStore();
  delete data.histories[historyKey(channelId, userId)];
  writeStore(data);
}

module.exports = { isEnabled, setEnabled, getHistory, addHistory, clearHistory };
