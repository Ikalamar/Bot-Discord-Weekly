const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { loadConfig, saveConfig } = require('../../config-store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-role')
    .setDescription('Configure le role mentionne dans les annonces de weekly')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((opt) => opt.setName('role').setDescription('Role a mentionner').setRequired(true))
    .addBooleanOption((opt) =>
      opt.setName('retirer').setDescription('Retirer le role (plus de mention)').setRequired(false),
    ),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const remove = interaction.options.getBoolean('retirer') || false;

    const config = loadConfig();
    config.weeklyRoleId = remove ? null : role.id;
    saveConfig(config);

    await interaction.reply({
      content: remove ? 'Mention de role retiree des annonces.' : `Role mentionne dans les annonces : ${role}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
