
require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  InteractionContextType,
  ApplicationIntegrationType,
  PermissionFlagsBits,
} = require("discord.js");

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env");
  process.exit(1);
}

const guildInstall = ApplicationIntegrationType.GuildInstall;

const commands = [
  new SlashCommandBuilder()
    .setName("enable")
    .setDescription("Enable AI replies in this channel.")
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM
    )
    .setIntegrationTypes(guildInstall)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("disable")
    .setDescription("Disable AI replies in this channel.")
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM
    )
    .setIntegrationTypes(guildInstall)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("server-setup")
    .setDescription("Preview an AI-generated Discord server setup plan.")
    .addStringOption(option =>
      option
        .setName("prompt")
        .setDescription("Describe the channels, categories, and roles you want.")
        .setRequired(true)
        .setMaxLength(1500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(guildInstall)
    .toJSON(),
];

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");

    if (process.env.DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID,
          process.env.DISCORD_GUILD_ID
        ),
        { body: commands }
      );
      console.log("Guild slash commands registered.");
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands }
      );
      console.log("Global slash commands registered.");
    }
  } catch (error) {
    console.error("Command registration failed:", error);
    process.exitCode = 1;
  }
})();
