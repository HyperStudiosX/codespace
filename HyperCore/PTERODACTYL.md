# Pterodactyl deployment

- Startup command: `npm start`
- Required variables: `DISCORD_TOKEN`, `CLIENT_ID`
- Optional variables: `DEFAULT_PREFIX`, `OWNER_IDS`, PostgreSQL variables
- Node version: 20.11 or newer

If the panel allows an installation command, use `npm install`. Deploy slash commands once with `npm run deploy` using the same environment variables. Make sure the bot has the **Server Members Intent** and **Message Content Intent** enabled in the Discord Developer Portal.

PostgreSQL is optional in this starter. If you don't set PostgreSQL variables, the bot persists settings to `.data/store.json`; ensure your server's filesystem is persistent. If you configure PostgreSQL, the database/user must already exist and the bot will create its own tables.
