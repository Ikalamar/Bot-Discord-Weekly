const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const sheets = require('../../sheets');
const { findExistingMatch } = require('../../startgg/duplicate-check');
const { loadConfig } = require('../../config-store');
const { askConfirmation, askCreateConfirmation } = require('../confirm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('next-tournament')
    .setDescription('Verifie le prochain tournoi Weekly du calendrier et propose de le creer')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    let row;
    try {
      row = await sheets.getNextRow();
    } catch (err) {
      await interaction.editReply(`Impossible de lire le sheet : ${err.message}`);
      return;
    }

    if (!row) {
      await interaction.editReply('Aucun tournoi Weekly a venir trouve dans le sheet.');
      return;
    }

    // Meme verification que celle faite automatiquement chaque jour, pour ne jamais proposer de
    // creer un tournoi qui existe deja.
    const match = await findExistingMatch(row.name);

    if (match) {
      await askConfirmation(interaction.client, row, match);

      const { controlChannel } = loadConfig();
      const controlRef = controlChannel ? `<#${controlChannel}>` : 'le salon de contrôle';
      await interaction.editReply(`🔎 **${row.name}** existe déjà — confirmation demandée dans ${controlRef}.`);
      return;
    }

    await askCreateConfirmation(interaction, row);
  },
};
