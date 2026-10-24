require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('./src/database/store');
const { commandDefs, moduleData, execute } = require('./src/commands/commands');
const { embed } = require('./src/utils/embeds');
const { emoji } = require('./src/utils/emoji');
const config = require('./config/config');

if (!process.env.DISCORD_TOKEN) { console.error('[STARTUP] Missing DISCORD_TOKEN. Add it in .env or your Pterodactyl environment variables.'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessageReactions], partials:[Partials.Channel,Partials.Message,Partials.GuildMember,Partials.User] });
const antiNukeBuckets = new Map();

client.once(Events.ClientReady, c => console.log(`[READY] ${c.user.tag} is online in ${c.guilds.cache.size} server(s).`));
client.on(Events.InteractionCreate, async interaction => {
 try {
  if (interaction.isChatInputCommand()) { await execute(interaction.commandName, { interaction, client }); return; }
  if (interaction.isStringSelectMenu() && interaction.customId==='hc_help_module') {
    const mod=moduleData.find(x=>x.name===interaction.values[0]);
    if(!mod) return interaction.reply({content:'Module not found.',ephemeral:true});
    const e=embed(`${emoji('help',interaction.guild)} ${mod.name}`,mod.commands.map(x=>`• ${x}`).join('\n')+'\n\nUse `/help` to return to the module selector.');
    return interaction.reply({embeds:[e],ephemeral:true});
  }
  if (interaction.isButton() && interaction.customId==='hc_ticket_create') {
    const guild=interaction.guild; const settings=await db.getGuild(guild.id);
    const existing=guild.channels.cache.find(ch=>ch.type===ChannelType.GuildText && ch.topic===`HyperCore ticket owner:${interaction.user.id}`);
    if(existing) return interaction.reply({content:`You already have an open ticket: ${existing}`,ephemeral:true});
    const safeName=interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,18)||'member';
    const channel=await guild.channels.create({name:`ticket-${safeName}`,type:ChannelType.GuildText,topic:`HyperCore ticket owner:${interaction.user.id}`,permissionOverwrites:[{id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:interaction.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ReadMessageHistory]}]});
    await db.createTicket({guildId:guild.id,channelId:channel.id,userId:interaction.user.id});
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hc_ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger));
    await channel.send({content:`${interaction.user} Welcome to your support ticket. Describe your issue and a staff member will help you.`,embeds:[embed('Ticket Controls','Use the button below to close this ticket.')],components:[row]});
    return interaction.reply({content:`${emoji('success',guild)} Created your ticket: ${channel}`,ephemeral:true});
  }
  if (interaction.isButton() && interaction.customId==='hc_ticket_close') {
    const ticket=await db.getTicket(interaction.channelId);
    if(!ticket) return interaction.reply({content:'Ticket record not found.',ephemeral:true});
    const ownerId=ticket.user_id||ticket.userId; const allowed=interaction.user.id===ownerId || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
    if(!allowed) return interaction.reply({content:'Only the ticket creator or staff can close this ticket.',ephemeral:true});
    await db.closeTicket(interaction.channelId); await interaction.reply({content:`${emoji('success',interaction.guild)} Ticket closed. This channel will be deleted in 5 seconds.`});
    setTimeout(()=>interaction.channel?.delete('Hyper Core ticket closed').catch(()=>{}),5000);
  }
 } catch(error) { console.error('[INTERACTION ERROR]',error); const payload={content:`${emoji('error',interaction.guild)} Something went wrong. Check the bot console for details.`,ephemeral:true}; if(interaction.isRepliable()) { if(interaction.replied||interaction.deferred) await interaction.followUp(payload).catch(()=>{}); else await interaction.reply(payload).catch(()=>{}); } }
});

client.on(Events.MessageCreate, async message => {
 try {
  if(message.author.bot || !message.guild) return;
  const settings=await db.getGuild(message.guild.id); const prefix=settings.prefix || config.defaultPrefix;
  if(settings.automodEnabled && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    const invite=/(discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(message.content);
    const link=/https?:\/\//i.test(message.content);
    if(invite||link) { await message.delete().catch(()=>{}); const warn=await message.channel.send(`${emoji('automod',message.guild)} ${message.author}, links/invites are blocked by AutoMod here.`).catch(()=>null); if(warn) setTimeout(()=>warn.delete().catch(()=>{}),5000); return; }
  }
  if(!message.content.startsWith(prefix)) return;
  const parts=message.content.slice(prefix.length).trim().split(/\s+/); const name=(parts.shift()||'').toLowerCase();
  const aliases={server:'serverinfo',userinfo:'userinfo',logsreset:'logs-reset','ticket':'ticket-panel',commands:'help'};
  const command=aliases[name]||name;
  if(command==='help') return message.reply({embeds:[require('./src/commands/commands').helpPayload(message.guild).embeds[0]],components:require('./src/commands/commands').helpPayload(message.guild).components});
  if(command==='ping'||command==='serverinfo'||command==='userinfo'||command==='avatar'||command==='prefix') {
    // Prefix aliases use the same handler where supported; provide clear guidance for option-heavy commands.
    if(command==='prefix') { const fake={...message}; return execute('prefix',{message,client}); }
    if(command==='ping') return message.reply({embeds:[embed('Pong!',`WebSocket: **${client.ws.ping}ms**\nDatabase: **${db.databaseMode()}**`)]});
    if(command==='serverinfo') return message.reply({embeds:[embed(`${message.guild.name} — Server Info`,`Members: **${message.guild.memberCount}**\nChannels: **${message.guild.channels.cache.size}**\nRoles: **${message.guild.roles.cache.size}**`)]});
    if(command==='userinfo'||command==='avatar') { const u=message.mentions.users.first()||message.author; const e=embed(u.tag,command==='avatar'?'':`ID: ${u.id}\nCreated: <t:${Math.floor(u.createdTimestamp/1000)}:D>`); if(command==='avatar') e.setImage(u.displayAvatarURL({size:1024})); else e.setThumbnail(u.displayAvatarURL({size:256})); return message.reply({embeds:[e]}); }
  }
  if(['slowmode','lock','unlock','say','poll'].includes(command)) {
    if(['slowmode','lock','unlock','say'].includes(command) && !message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply(`${emoji('error',message.guild)} You need the appropriate management permission.`);
    if(command==='slowmode') { const seconds=Number(parts[0]); if(!Number.isInteger(seconds)||seconds<0||seconds>21600) return message.reply(`Usage: \`${prefix}slowmode <0-21600 seconds>\``); await message.channel.setRateLimitPerUser(seconds,`Set by ${message.author.tag}`); return message.reply(`${emoji('success',message.guild)} Slowmode set to ${seconds} second(s).`); }
    if(command==='lock'||command==='unlock') { await message.channel.permissionOverwrites.edit(message.guild.roles.everyone,{SendMessages:command==='lock'?false:null,SendMessagesInThreads:command==='lock'?false:null},{reason:`${command} by ${message.author.tag}`}); return message.reply(`${emoji('success',message.guild)} Channel ${command==='lock'?'locked':'unlocked'}.`); }
    if(command==='say') { const text=parts.join(' '); if(!text) return message.reply(`Usage: \`${prefix}say <message>\``); await message.channel.send({content:text,allowedMentions:{parse:[]}}); return; }
    if(command==='poll') { const question=parts.join(' '); if(!question) return message.reply(`Usage: \`${prefix}poll <question>\``); const sent=await message.channel.send({embeds:[embed('📊 Poll',question)]}); await sent.react('👍'); await sent.react('👎'); return; }
  }
  if(['ban','kick','purge','timeout','untimeout','role-add','role-remove'].includes(command)) {
    if(!message.member.permissions.has(PermissionFlagsBits.Administrator) && !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply(`${emoji('error',message.guild)} You need Manage Server to use this prefix command.`);
    const target=message.mentions.members.first();
    if(command==='purge') { const n=Number(parts[0]); if(!Number.isInteger(n)||n<1||n>100) return message.reply('Usage: `&purge 1-100`'); const deleted=await message.channel.bulkDelete(n,true); return message.channel.send(`${emoji('success',message.guild)} Deleted ${deleted.size} messages.`).then(x=>setTimeout(()=>x.delete().catch(()=>{}),4000)); }
    if(!target) return message.reply(`Usage: \`${prefix}${command} @member\``);
    if(command==='ban') await target.ban({reason:parts.slice(1).join(' ')||`By ${message.author.tag}`});
    if(command==='kick') await target.kick(parts.slice(1).join(' ')||`By ${message.author.tag}`);
    if(command==='timeout') await target.timeout(Math.max(1,Number(parts[1])||10)*60000,`By ${message.author.tag}`);
    if(command==='untimeout') await target.timeout(null,`By ${message.author.tag}`);
    return message.reply(`${emoji('success',message.guild)} ${command} completed for ${target.user.tag}.`);
  }
 } catch(error) { console.error('[MESSAGE COMMAND ERROR]',error); message.reply(`${emoji('error',message.guild)} Command failed. Check the bot console.`).catch(()=>{}); }
});

client.on(Events.GuildMemberAdd, async member => { try { const s=await db.getGuild(member.guild.id); const ch=s.welcomeChannelId && member.guild.channels.cache.get(s.welcomeChannelId); if(ch) await ch.send({embeds:[embed(`${emoji('welcome',member.guild)} Welcome to ${member.guild.name}!`,`Welcome ${member} — you are member **${member.guild.memberCount}**.`)]}); } catch(e){console.error('[WELCOME ERROR]',e);} });
client.on(Events.MessageDelete, async message => { try { if(!message.guild || message.author?.bot) return; const s=await db.getGuild(message.guild.id); const ch=s.logChannelId && message.guild.channels.cache.get(s.logChannelId); if(ch) await ch.send({embeds:[embed(`${emoji('logging',message.guild)} Message Deleted`,`**Author:** ${message.author||'Unknown'}\n**Channel:** ${message.channel}\n**Content:** ${(message.content||'[No cached content]').slice(0,1500)}`)]}); } catch(e){console.error('[LOG DELETE ERROR]',e);} });
client.on(Events.GuildMemberRemove, async member => { try { const s=await db.getGuild(member.guild.id); const ch=s.logChannelId && member.guild.channels.cache.get(s.logChannelId); if(ch) await ch.send({embeds:[embed('Member Left',`${member.user.tag} (${member.id}) left the server.`)]}); } catch(e){console.error('[MEMBER LOG ERROR]',e);} });
client.on(Events.VoiceStateUpdate, async (oldState,newState) => { try {
  if(newState.guild && newState.channelId) {
    const s=await db.getGuild(newState.guild.id);
    if(newState.channelId===s.j2cChannelId) {
      const channel=await newState.guild.channels.create({name:`${newState.member.user.username}'s room`.slice(0,95),type:ChannelType.GuildVoice,parent:newState.channel?.parentId||undefined,permissionOverwrites:[{id:newState.guild.roles.everyone.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect]}]});
      await newState.setChannel(channel);
    }
  }
  const oldChannel=oldState.channel;
  if(oldChannel && oldChannel.name && oldChannel.name.endsWith("'s room") && oldChannel.members.size===0) await oldChannel.delete('Empty Join-2-Create room').catch(()=>{});
 } catch(e){console.error('[J2C ERROR]',e);} });

process.on('unhandledRejection', e=>console.error('[UNHANDLED REJECTION]',e));
process.on('uncaughtException', e=>console.error('[UNCAUGHT EXCEPTION]',e));
(async()=>{ try { await db.init(); await client.login(process.env.DISCORD_TOKEN); } catch(e) { console.error('[STARTUP ERROR]',e); process.exit(1); } })();
