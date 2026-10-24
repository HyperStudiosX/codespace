'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../../config/config');
const { emoji } = require('../utils/emoji');

const COMMANDS_ROOT = __dirname;
const SELECT_PREFIX = 'hypercore_help';

const MODULES = [
  { id: 'antinuke', name: 'AntiNuke', category: 'Core Modules', description: 'Anti-nuke protection and server security.', emoji: 'moderation' },
  { id: 'moderation', name: 'Moderation', category: 'Core Modules', description: 'Member moderation commands.', emoji: 'moderation' },
  { id: 'automod', name: 'AutoMod', category: 'Core Modules', description: 'Automated moderation and filters.', emoji: 'automod' },
  { id: 'logger', name: 'Logger', category: 'Core Modules', description: 'Server event logging.', emoji: 'logging' },
  { id: 'utility', name: 'Utility', category: 'Core Modules', description: 'General utility commands.', emoji: 'utility' },
  { id: 'join2create', name: 'Join 2 Create', category: 'Extra Modules', description: 'Create temporary voice channels.', emoji: 'voice' },
  { id: 'voice', name: 'Voice', category: 'Extra Modules', description: 'Voice channel controls.', emoji: 'voice' },
  { id: 'customrole', name: 'Custom Role', category: 'Extra Modules', description: 'Custom role tools.', emoji: 'roles' },
  { id: 'messager', name: 'Messager', category: 'Extra Modules', description: 'Join, leave, welcome, farewell and invite messages.', emoji: 'welcome' }
];

function listCommandFiles(folder) {
  if (!fs.existsSync(folder)) return [];
  const found = [];

  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      found.push(...listCommandFiles(fullPath));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name.startsWith('_')) continue;

    try {
      const exported = require(fullPath);
      const json = exported?.data?.toJSON?.() || {};
      const name = exported?.name || json.name;
      if (!name) continue;

      found.push({
        name: String(name),
        description: String(exported.description || json.description || 'No description provided'),
        file: fullPath
      });
    } catch (error) {
      console.error(`[HELP] Could not read ${fullPath}: ${error.message}`);
    }
  }

  return found;
}

function getCommands(moduleId, kind = 'all') {
  const root = path.join(COMMANDS_ROOT, moduleId);
  const commands = [];

  if (kind === 'all' || kind === 'slash') {
    for (const command of listCommandFiles(path.join(root, 'slashCommands'))) {
      commands.push({ ...command, kind: 'slash' });
    }
  }

  if (kind === 'all' || kind === 'prefix') {
    for (const command of listCommandFiles(path.join(root, 'prefixCommands'))) {
      commands.push({ ...command, kind: 'prefix' });
    }
  }

  const unique = new Map();
  for (const command of commands) {
    unique.set(`${command.kind}:${command.name.toLowerCase()}`, command);
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function makeEmbed(title, description, color = config.colors?.primary || 0xF07824) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (config.brand) embed.setFooter({ text: config.brand });
  return embed;
}

function moduleHasCommands(module) {
  return getCommands(module.id).length > 0;
}

function makeSelect(category) {
  const options = MODULES
    .filter(module => module.category === category && moduleHasCommands(module))
    .slice(0, 25)
    .map(module => ({
      label: module.name,
      description: `${getCommands(module.id).length} command(s)`.slice(0, 100),
      value: module.id
    }));

  if (!options.length) {
    options.push({
      label: 'No commands added yet',
      description: 'Add command files to this module folder first.',
      value: 'none'
    });
  }

  const categoryId = category === 'Core Modules' ? 'core' : 'extra';
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${SELECT_PREFIX}:${categoryId}`)
    .setPlaceholder(`Select ${category}`)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

function createHelpMenu(guild, prefix = config.defaultPrefix || '&') {
  const core = MODULES.filter(m => m.category === 'Core Modules' && moduleHasCommands(m));
  const extra = MODULES.filter(m => m.category === 'Extra Modules' && moduleHasCommands(m));
  const coreCount = core.reduce((n, m) => n + getCommands(m.id).length, 0);
  const extraCount = extra.reduce((n, m) => n + getCommands(m.id).length, 0);

  const helpEmoji = emoji('help', guild);
  const description = [
    'Choose a category dropdown, then select a module to view its commands.',
    '',
    `${emoji('moderation', guild)} **Core Modules:** ${coreCount} commands across ${core.length} modules`,
    `${emoji('utility', guild)} **Extra Modules:** ${extraCount} commands across ${extra.length} modules`,
    '',
    `**Prefix:** \`${prefix}\``,
    '**Command types:** Slash and prefix'
  ].join('\n');

  return {
    embeds: [makeEmbed(`${helpEmoji} Hyper Core | Help Dashboard`, description)],
    components: [makeSelect('Core Modules'), makeSelect('Extra Modules')]
  };
}

function createModuleEmbed(moduleId, guild, prefix = config.defaultPrefix || '&') {
  const module = MODULES.find(item => item.id === moduleId);
  if (!module) return makeEmbed('Module not found', 'Run the help command again.');

  const commands = getCommands(moduleId);
  if (!commands.length) {
    return makeEmbed(`${emoji(module.emoji, guild)} ${module.name}`, 'No commands have been added to this module yet.');
  }

  const lines = [];
  const slash = commands.filter(c => c.kind === 'slash');
  const prefixCommands = commands.filter(c => c.kind === 'prefix');

  if (slash.length) {
    lines.push('**Slash Commands**');
    for (const command of slash) lines.push(`\`/${command.name}\` — ${command.description}`);
  }
  if (prefixCommands.length) {
    if (lines.length) lines.push('');
    lines.push('**Prefix Commands**');
    for (const command of prefixCommands) lines.push(`\`${prefix}${command.name}\` — ${command.description}`);
  }

  let description = `${module.description}\n\n${lines.join('\n')}`;
  if (description.length > 4000) description = `${description.slice(0, 3900)}\n\n...list shortened.`;

  return makeEmbed(`${emoji(module.emoji, guild)} ${module.name}`, description);
}

async function handleHelpMenuInteraction(interaction, prefix) {
  if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith(`${SELECT_PREFIX}:`)) {
    return false;
  }

  const moduleId = interaction.values[0];
  if (moduleId === 'none') {
    await interaction.reply({ content: 'No command files have been added to this category yet.', ephemeral: true });
    return true;
  }

  await interaction.reply({
    embeds: [createModuleEmbed(moduleId, interaction.guild, prefix)],
    ephemeral: true
  });
  return true;
}

module.exports = {
  MODULES,
  getCommands,
  createHelpMenu,
  createModuleEmbed,
  handleHelpMenuInteraction,
  SELECT_PREFIX
};
