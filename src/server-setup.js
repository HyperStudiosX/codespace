
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { randomUUID } = require("node:crypto");
const { askAI } = require("./ai");

const pendingPlans = new Map();
const MAX_ACTIONS = 30;
const PLAN_LIFETIME_MS = 5 * 60 * 1000;

// Deliberately excludes Administrator and server-management permissions.
const SAFE_ROLE_PERMISSIONS = [
  "ViewChannel",
  "SendMessages",
  "ReadMessageHistory",
  "Connect",
  "Speak",
  "AttachFiles",
  "EmbedLinks",
  "UseApplicationCommands",
  "AddReactions",
  "SendMessagesInThreads",
  "CreatePublicThreads",
  "CreatePrivateThreads",
  "UseExternalEmojis",
  "UseExternalStickers",
  "Stream",
];

const ALLOWED_TYPES = new Set([
  "create_category",
  "create_text_channel",
  "create_voice_channel",
  "edit_channel",
  "delete_channel",
  "create_role",
  "edit_role",
  "delete_role",
]);

function makeEmbed(title, description, color = 0xf28c28) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(String(description || " ").slice(0, 4000))
    .setFooter({ text: "HyperForgeX AI • Review every change before applying" })
    .setTimestamp();
}

function cleanName(value, max = 100) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function parseAIJson(text) {
  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("AI did not return a valid JSON plan. Please try a more specific prompt.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function validatePlan(raw) {
  if (!raw || !Array.isArray(raw.actions)) {
    throw new Error("The AI plan has no valid actions array. Try a more specific prompt.");
  }

  if (raw.actions.length === 0) {
    throw new Error("The AI did not propose any changes.");
  }

  if (raw.actions.length > MAX_ACTIONS) {
    throw new Error(`The plan has too many actions. Maximum allowed: ${MAX_ACTIONS}. Split the request into smaller plans.`);
  }

  const actions = raw.actions.map((item, index) => {
    if (!item || !ALLOWED_TYPES.has(item.type)) {
      throw new Error(`Action ${index + 1} has an unsupported operation.`);
    }

    const action = {
      type: item.type,
      name: cleanName(item.name),
      old_name: cleanName(item.old_name),
      category: cleanName(item.category),
      topic: typeof item.topic === "string" ? item.topic.slice(0, 1024) : "",
      reason: cleanName(item.reason, 250) || "Requested server setup change",
      color: cleanName(item.color, 20),
      hoist: typeof item.hoist === "boolean" ? item.hoist : undefined,
      mentionable: typeof item.mentionable === "boolean" ? item.mentionable : undefined,
      permissions: Array.isArray(item.permissions) ? item.permissions : undefined,
    };

    if ([
      "create_category",
      "create_text_channel",
      "create_voice_channel",
      "create_role",
    ].includes(action.type) && !action.name) {
      throw new Error(`Action ${index + 1} needs a name.`);
    }

    if ([
      "edit_channel",
      "delete_channel",
      "edit_role",
      "delete_role",
    ].includes(action.type) && !action.old_name) {
      throw new Error(`Action ${index + 1} needs old_name to identify the existing item.`);
    }

    if (action.type === "edit_channel" && !action.name && !action.topic && !action.category) {
      throw new Error(`Action ${index + 1} does not specify a channel change.`);
    }

    if (action.type === "edit_role" &&
        !action.name &&
        !action.color &&
        action.hoist === undefined &&
        action.mentionable === undefined &&
        action.permissions === undefined) {
      throw new Error(`Action ${index + 1} does not specify a role change.`);
    }

    if (action.permissions !== undefined) {
      action.permissions = action.permissions.filter(
        p => typeof p === "string" && SAFE_ROLE_PERMISSIONS.includes(p)
      );
    }

    if (action.color && !/^#?[0-9a-f]{6}$/i.test(action.color)) {
      action.color = "";
    }

    return action;
  });

  return {
    summary: cleanName(raw.summary, 1000) || "Proposed Discord server changes",
    actions,
  };
}

function describeAction(action, index) {
  const prefix = `${index + 1}.`;

  switch (action.type) {
    case "create_category":
      return `${prefix} Create category **${action.name}**`;
    case "create_text_channel":
      return `${prefix} Create text channel **#${action.name}**${action.category ? ` in ${action.category}` : ""}`;
    case "create_voice_channel":
      return `${prefix} Create voice channel **${action.name}**${action.category ? ` in ${action.category}` : ""}`;
    case "edit_channel":
      return `${prefix} Edit channel **${action.old_name}**${action.name ? ` → ${action.name}` : ""}${action.category ? `; category: ${action.category}` : ""}`;
    case "delete_channel":
      return `${prefix} **DELETE** channel **${action.old_name}**`;
    case "create_role":
      return `${prefix} Create role **${action.name}**`;
    case "edit_role":
      return `${prefix} Edit role **${action.old_name}**${action.name ? ` → ${action.name}` : ""}`;
    case "delete_role":
      return `${prefix} **DELETE** role **${action.old_name}**`;
    default:
      return `${prefix} Unknown action`;
  }
}

function getPlanEmbed(plan, title = "Server Setup • Preview", color = 0xf28c28) {
  const lines = plan.actions.map(describeAction);
  const description =
    `**Plan:** ${plan.summary}\n` +
    `**Actions:** ${plan.actions.length}\n\n` +
    lines.join("\n");

  return makeEmbed(title, description, color);
}

function findChannel(guild, name) {
  const normalized = name.toLowerCase();
  return guild.channels.cache.find(
    c => c.name.toLowerCase() === normalized
  );
}

function findRole(guild, name) {
  const normalized = name.toLowerCase();
  return guild.roles.cache.find(
    r => r.name.toLowerCase() === normalized
  );
}

function resolveRolePermissions(names) {
  if (!Array.isArray(names)) return [];
  return names.filter(name => SAFE_ROLE_PERMISSIONS.includes(name));
}

async function applyOne(guild, action) {
  switch (action.type) {
    case "create_category": {
      if (findChannel(guild, action.name)) {
        throw new Error(`A channel/category named "${action.name}" already exists.`);
      }
      await guild.channels.create({
        name: action.name,
        type: ChannelType.GuildCategory,
        reason: action.reason,
      });
      return `Created category: ${action.name}`;
    }

    case "create_text_channel":
    case "create_voice_channel": {
      if (findChannel(guild, action.name)) {
        throw new Error(`A channel named "${action.name}" already exists.`);
      }

      let parent;
      if (action.category) {
        parent = findChannel(guild, action.category);
        if (!parent || parent.type !== ChannelType.GuildCategory) {
          throw new Error(`Category "${action.category}" was not found.`);
        }
      }

      const type = action.type === "create_text_channel"
        ? ChannelType.GuildText
        : ChannelType.GuildVoice;

      await guild.channels.create({
        name: action.name,
        type,
        parent: parent?.id,
        ...(type === ChannelType.GuildText && action.topic
          ? { topic: action.topic }
          : {}),
        reason: action.reason,
      });

      return `Created ${type === ChannelType.GuildText ? "text" : "voice"} channel: ${action.name}`;
    }

    case "edit_channel": {
      const channel = findChannel(guild, action.old_name);
      if (!channel) throw new Error(`Channel "${action.old_name}" was not found.`);

      if (action.name) await channel.setName(action.name, action.reason);

      if (action.topic && channel.type === ChannelType.GuildText) {
        await channel.setTopic(action.topic, action.reason);
      }

      if (action.category) {
        const parent = findChannel(guild, action.category);
        if (!parent || parent.type !== ChannelType.GuildCategory) {
          throw new Error(`Category "${action.category}" was not found.`);
        }
        await channel.setParent(parent.id, { reason: action.reason });
      }

      return `Edited channel: ${action.old_name}`;
    }

    case "delete_channel": {
      const channel = findChannel(guild, action.old_name);
      if (!channel) throw new Error(`Channel "${action.old_name}" was not found.`);
      await channel.delete(action.reason);
      return `Deleted channel: ${action.old_name}`;
    }

    case "create_role": {
      if (findRole(guild, action.name)) {
        throw new Error(`Role "${action.name}" already exists.`);
      }

      const options = {
        name: action.name,
        permissions: resolveRolePermissions(action.permissions),
        reason: action.reason,
      };

      if (action.color) options.color = parseInt(action.color.replace("#", ""), 16);
      if (action.hoist !== undefined) options.hoist = action.hoist;
      if (action.mentionable !== undefined) options.mentionable = action.mentionable;

      await guild.roles.create(options);
      return `Created role: ${action.name}`;
    }

    case "edit_role": {
      const role = findRole(guild, action.old_name);
      if (!role) throw new Error(`Role "${action.old_name}" was not found.`);
      if (role.id === guild.id || role.managed) {
        throw new Error("The @everyone role and integration-managed roles cannot be edited.");
      }

      const options = { reason: action.reason };
      if (action.name) options.name = action.name;
      if (action.color) options.color = parseInt(action.color.replace("#", ""), 16);
      if (action.hoist !== undefined) options.hoist = action.hoist;
      if (action.mentionable !== undefined) options.mentionable = action.mentionable;
      if (action.permissions !== undefined) {
        options.permissions = resolveRolePermissions(action.permissions);
      }

      await role.edit(options);
      return `Edited role: ${action.old_name}`;
    }

    case "delete_role": {
      const role = findRole(guild, action.old_name);
      if (!role) throw new Error(`Role "${action.old_name}" was not found.`);
      if (role.id === guild.id || role.managed) {
        throw new Error("The @everyone role and integration-managed roles cannot be deleted.");
      }

      await role.delete(action.reason);
      return `Deleted role: ${action.old_name}`;
    }

    default:
      throw new Error("Unsupported operation.");
  }
}

async function handleServerSetupInteraction(interaction) {
  if (interaction.isChatInputCommand() &&
      interaction.commandName === "server-setup") {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used inside a Discord server.",
        ephemeral: true,
      });
      return true;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "You need the **Manage Server** permission to use this command.",
        ephemeral: true,
      });
      return true;
    }

    const prompt = interaction.options.getString("prompt", true).trim();
    if (!prompt) {
      await interaction.reply({ content: "Please describe the server setup you want.", ephemeral: true });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const botMember = interaction.guild.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels) ||
          !botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.editReply({
          embeds: [makeEmbed(
            "Missing Bot Permissions",
            "Give the bot **Manage Channels** and **Manage Roles**, then try again.",
            0xe74c3c
          )],
        });
        return true;
      }

      const systemPrompt = `
You design Discord server structure plans. Return ONLY valid JSON, no Markdown.
Schema:
{
  "summary": "short plan summary",
  "actions": [
    {
      "type": "create_category | create_text_channel | create_voice_channel | edit_channel | delete_channel | create_role | edit_role | delete_role",
      "name": "new name where applicable",
      "old_name": "exact existing name for edit/delete",
      "category": "category name for new/moved channels",
      "topic": "optional text-channel topic",
      "reason": "short audit-log reason",
      "color": "#RRGGBB",
      "hoist": false,
      "mentionable": false,
      "permissions": ["ViewChannel", "SendMessages"]
    }
  ]
}
Rules:
- Produce at most ${MAX_ACTIONS} actions and keep the plan practical.
- Use exact existing names supplied by the user for edits/deletions.
- Prefer creating new channels/roles when the request is unclear; do not guess what to delete.
- Do not delete channels or roles unless the user explicitly asks for deletion and identifies them.
- Never target @everyone, integration-managed roles, or system channels for deletion.
- Do not grant Administrator, ManageGuild, ManageRoles, ManageChannels, or other elevated permissions.
- Role permissions may only use this safe allowlist: ${SAFE_ROLE_PERMISSIONS.join(", ")}.
- Keep every action's reason short. If the prompt is ambiguous, make a conservative plan.
- Do not include any action outside the schema.
`;

      const raw = await askAI("development", [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Server: ${interaction.guild.name}\nUser request: ${prompt}` },
      ]);

      const plan = validatePlan(parseAIJson(raw));
      const planId = randomUUID();

      pendingPlans.set(planId, {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        plan,
        expiresAt: Date.now() + PLAN_LIFETIME_MS,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hfx_setup_apply:${planId}`)
          .setLabel("Apply Changes")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`hfx_setup_cancel:${planId}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({
        embeds: [
          getPlanEmbed(plan),
          makeEmbed(
            "Review Before Applying",
            "Check every action carefully. Deletions cannot always be undone. The plan expires in 5 minutes. Role permissions are restricted to a safe allowlist."
          ),
        ],
        components: [row],
      });
    } catch (error) {
      console.error("Server setup planning error:", error);
      await interaction.editReply({
        embeds: [makeEmbed(
          "Could Not Build Setup Plan",
          String(error.message || "Unknown error").slice(0, 1500),
          0xe74c3c
        )],
      }).catch(() => {});
    }

    return true;
  }

  if (!interaction.isButton()) return false;

  const isApply = interaction.customId.startsWith("hfx_setup_apply:");
  const isCancel = interaction.customId.startsWith("hfx_setup_cancel:");
  if (!isApply && !isCancel) return false;

  const planId = interaction.customId.split(":")[1];
  const entry = pendingPlans.get(planId);

  if (!entry || entry.expiresAt < Date.now()) {
    pendingPlans.delete(planId);
    await interaction.reply({
      content: "This setup preview has expired. Run `/server-setup` again.",
      ephemeral: true,
    });
    return true;
  }

  if (interaction.guildId !== entry.guildId ||
      interaction.user.id !== entry.userId) {
    await interaction.reply({
      content: "Only the person who created this preview can apply or cancel it.",
      ephemeral: true,
    });
    return true;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: "You need **Manage Server** permission to do this.",
      ephemeral: true,
    });
    return true;
  }

  if (isCancel) {
    pendingPlans.delete(planId);
    await interaction.update({
      embeds: [makeEmbed("Setup Cancelled", "No server changes were applied.", 0x808080)],
      components: [],
    });
    return true;
  }

  const guild = interaction.guild;
  const botMember = guild?.members.me;

  if (!guild || !botMember?.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    pendingPlans.delete(planId);
    await interaction.update({
      embeds: [makeEmbed(
        "Missing Bot Permissions",
        "No changes were applied. Ensure the bot has **Manage Channels** and **Manage Roles**, then create a new preview.",
        0xe74c3c
      )],
      components: [],
    });
    return true;
  }

  // Remove the pending plan before applying to prevent double-clicks.
  pendingPlans.delete(planId);
  await interaction.update({
    embeds: [makeEmbed("Applying Setup Plan", "Applying approved actions in order. Please wait…")],
    components: [],
  });

  const results = [];
  for (let i = 0; i < entry.plan.actions.length; i++) {
    const action = entry.plan.actions[i];
    try {
      const result = await applyOne(guild, action);
      results.push(`✅ ${i + 1}. ${result}`);
    } catch (error) {
      console.error(`Server setup action ${i + 1} failed:`, error);
      results.push(`❌ ${i + 1}. ${action.type}: ${String(error.message || "Failed").slice(0, 180)}`);
    }
  }

  const description = results.join("\n").slice(0, 3900);
  await interaction.editReply({
    embeds: [makeEmbed("Server Setup • Results", description, 0xf28c28)],
    components: [],
  }).catch(console.error);

  return true;
}

module.exports = { handleServerSetupInteraction };
