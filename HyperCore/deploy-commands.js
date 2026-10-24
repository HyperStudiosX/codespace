require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commandDefs } = require('./src/commands/commands');
if(!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) { console.error('Set DISCORD_TOKEN and CLIENT_ID in environment before deploying commands.'); process.exit(1); }
const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
(async()=>{ try { const body=commandDefs.map(c=>c.data.toJSON()); if(process.env.GUILD_ID) { await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID),{body}); console.log(`Deployed ${body.length} guild commands to ${process.env.GUILD_ID}.`); } else { await rest.put(Routes.applicationCommands(process.env.CLIENT_ID),{body}); console.log(`Deployed ${body.length} global commands. Global commands can take time to appear.`); } } catch(e) { console.error('Slash command deployment failed:',e); process.exit(1); } })();
