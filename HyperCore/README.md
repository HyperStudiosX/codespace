# Hyper Core

Discord.js v14 bot inspired by the features visible in your reference video. Includes a centralized PetroV3-style emoji configuration, slash and prefix commands, help dropdown, moderation, basic AutoMod, logging, welcome messages, tickets, Join-2-Create, and server prefix settings.

## Database setup (minimal by default)

Hyper Core does **not** require a MongoDB-style URI to start. If no PostgreSQL settings are supplied, it uses a built-in persistent JSON store in `.data/store.json`. If you have PostgreSQL already provided by Pterodactyl, configure either `DATABASE_URL` or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` and restart. PostgreSQL mode automatically creates its tables.

## Setup

1. Use Node.js 20.11+.
2. Copy `.env.example` to `.env` (or enter the same variables in Pterodactyl Startup/Variables).
3. Set `DISCORD_TOKEN` and `CLIENT_ID`. `CLIENT_ID` is the Discord application's ID, not the bot token.
4. In the Discord Developer Portal, enable **Server Members Intent** and **Message Content Intent**. Invite with `bot` and `applications.commands` scopes and permissions needed for the modules you use.
5. Install dependencies: `npm install`
6. Deploy slash commands: `npm run deploy`
7. Start: `npm start`

For fast testing, set `GUILD_ID` to your test server ID before running `npm run deploy`. Remove it later to deploy globally.

## Prefix commands

Default prefix is `&`, configurable per server with `&prefix ?` or `/prefix value:<new prefix>`. Prefix commands implemented include `&help`, `&ping`, `&serverinfo`, `&userinfo`, `&avatar`, `&ban @member`, `&kick @member`, `&timeout @member 10`, `&untimeout @member`, and `&purge 10`.

## Slash commands

`/help`, `/ping`, `/serverinfo`, `/userinfo`, `/avatar`, `/prefix`, `/ban`, `/kick`, `/timeout`, `/untimeout`, `/purge`, `/setup-logs`, `/logs-reset`, `/welcome-setup`, `/automod`, `/ticket-panel`, `/ticket-close`, `/antinuke`, `/j2c-setup`, `/role-add`, `/role-remove`.

## Emoji configuration

Edit `config/slash emojis.js`. Add custom emoji IDs to `id` and keep `fallback` as a backup. Emoji rendering is centralized in `src/utils/emoji.js`; do not hardcode custom emoji IDs in commands.

## Important scope notes

The source bot was not available, so this is a new implementation based on visible video evidence, not a byte-for-byte clone. The visible reference listed more commands than are implemented in this initial version. The anti-nuke command currently stores a threshold/configuration and does not automatically punish users. AutoMod currently filters invite links and URLs; review your server rules before enabling it. Test permissions and hierarchy in a private test server before production use.
