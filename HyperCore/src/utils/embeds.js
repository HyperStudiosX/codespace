const { EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
function embed(title, description, color = config.colors.primary) {
  const e = new EmbedBuilder().setColor(color).setTimestamp();
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  e.setFooter({ text: config.brand });
  return e;
}
module.exports = { embed };
