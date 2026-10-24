# Hyper Core modular structure setup

## Included
- `setup-modular-structure.js`: creates the requested folder structure in your existing Hyper Core project.
- `helpMenu.js`: copied to `src/commands/helpMenu.js` by the setup script.

## Use
1. Keep both files in the root of your current Hyper Core project, beside `package.json`.
2. Run: `node setup-modular-structure.js`
3. The script creates:
   - `src/commands/<module>/slashCommands/`
   - `src/commands/<module>/prefixCommands/`
   - `src/systems/<module>/`
4. It backs up `src/commands/commands.js` to `commands.js.old-backup` and then removes the old registry.

Modules: antinuke, moderation, automod, logger, utility, join2create, voice, customrole, messager.

**Important:** This scaffold intentionally creates empty command/system folders. Your current `index.js` and `deploy-commands.js` still import the old registry, so don't restart or deploy the bot after running this until those two files are updated to use the new modular loader. The next step is wiring the loader and interaction handlers.
