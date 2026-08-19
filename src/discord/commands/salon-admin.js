const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { loadConfig, saveConfig } = require('../../config-store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('salon-admin')
    .setDescription('Configure le salon de controle (validation des doublons avant annonce)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName('salon')
        .setDescription('Salon de controle')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addBooleanOption((opt) =>
      opt.setName('retirer').setDescription('Retirer le salon de controle').setRequired(false),
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    const remove = interaction.options.getBoolean('retirer') || false;

    const config = loadConfig();
    config.controlChannel = remove ? null : channel.id;
    saveConfig(config);

    await interaction.reply({
      content: remove ? 'Salon de controle retire.' : `Salon de controle : ${channel}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
