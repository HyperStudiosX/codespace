const emojis = require('../../config/slash emojis.js');
function emoji(key, guild) {
  const item = emojis[key];
  if (!item) return '';
  if (item.id && /^\d{17,20}$/.test(String(item.id))) {
    const cached = guild?.emojis?.cache?.get(String(item.id));
    if (cached) return cached.toString();
    return `<:hc_${key}:${item.id}>`;
  }
  return item.fallback || '';
}
function render(key, guild) { return emoji(key, guild); }
module.exports = { emoji, render, emojis };
