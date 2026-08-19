const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { loadConfig, saveConfig } = require('../../config-store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-channel')
    .setDescription('Configure les salons ou le bot annonce les tournois crees')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName('salon')
        .setDescription('Salon a ajouter (ou retirer) des annonces')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addBooleanOption((opt) =>
      opt.setName('retirer').setDescription("Retirer ce salon au lieu de l'ajouter").setRequired(false),
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    const remove = interaction.options.getBoolean('retirer') || false;

    const config = loadConfig();
    config.discordChannels = config.discordChannels || [];

    if (remove) {
      config.discordChannels = config.discordChannels.filter((id) => id !== channel.id);
      saveConfig(config);
      await interaction.reply({ content: `Salon ${channel} retire des annonces.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (!config.discordChannels.includes(channel.id)) {
      config.discordChannels.push(channel.id);
      saveConfig(config);
    }
    await interaction.reply({ content: `Salon ${channel} ajoute aux annonces.`, flags: MessageFlags.Ephemeral });
  },
};
