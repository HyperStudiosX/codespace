'use strict';

// Run from your Hyper Core project root: node setup-modular-structure.js
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const commandsRoot = path.join(root, 'src', 'commands');
const systemsRoot = path.join(root, 'src', 'systems');

const modules = [
  'antinuke',
  'moderation',
  'automod',
  'logger',
  'utility',
  'join2create',
  'voice',
  'customrole',
  'messager'
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const marker = path.join(dir, '.gitkeep');
  if (!fs.existsSync(marker)) fs.writeFileSync(marker, '', 'utf8');
}

function ensureFile(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8');
}

if (!fs.existsSync(path.join(root, 'package.json'))) {
  console.error('Run this script from the Hyper Core project root (the folder containing package.json).');
  process.exit(1);
}

for (const moduleName of modules) {
  ensureDir(path.join(commandsRoot, moduleName, 'slashCommands'));
  ensureDir(path.join(commandsRoot, moduleName, 'prefixCommands'));
  ensureDir(path.join(systemsRoot, moduleName));
}

// Put the prepared Help menu into the project.
const templateHelp = path.join(__dirname, 'helpMenu.js');
const targetHelp = path.join(commandsRoot, 'helpMenu.js');
if (!fs.existsSync(templateHelp)) {
  console.error('Missing helpMenu.js beside this setup script. Keep both files together.');
  process.exit(1);
}
fs.copyFileSync(templateHelp, targetHelp);

// Remove the old central command registry after backing it up.
const oldCommands = path.join(commandsRoot, 'commands.js');
if (fs.existsSync(oldCommands)) {
  const backup = path.join(root, 'commands.js.old-backup');
  if (!fs.existsSync(backup)) fs.copyFileSync(oldCommands, backup);
  fs.unlinkSync(oldCommands);
  console.log('Removed src/commands/commands.js (backup saved as commands.js.old-backup).');
}

console.log('Created modular command and system folders.');
console.log('IMPORTANT: index.js and deploy-commands.js still need to be wired to the new loader before starting/deploying the bot.');
