const { PermissionFlagsBits } = require('discord.js');
function isOwner(userId) { return (process.env.OWNER_IDS || '').split(',').map(x => x.trim()).filter(Boolean).includes(userId); }
function canManage(member) { return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.ManageGuild)); }
module.exports = { isOwner, canManage };
