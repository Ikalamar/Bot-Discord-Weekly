// Flux de confirmation par boutons, persistes sur disque
// (data/pending-confirmations.json) : un bouton Discord ne transporte qu'un
// identifiant court, et un clic peut arriver longtemps apres l'envoi, voire
// apres un redemarrage du bot.
//
//   - "announce" : le tournoi existe deja -> on demande dans le salon de
//     controle s'il faut annoncer la weekly.
//   - "create" : /next-tournament n'a trouve aucun doublon -> on demande s'il
//     faut lancer la creation.

const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const { DATA_DIR, PENDING_FILE } = require('../paths');
const { loadConfig } = require('../config-store');

function loadPending() {
  if (!fs.existsSync(PENDING_FILE)) return {};
  return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
}

function savePending(pending) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2) + '\n', 'utf8');
}

// --- "Faut-il annoncer ce tournoi deja existant ?" ---------------------------

/**
 * @param {import('discord.js').Client} client
 * @param {{ rowNumber: number, name: string, games: string[] }} row
 * @param {{ url: string, published: boolean, startAt: number|null, timezone: string|null }} match
 */
async function askConfirmation(client, row, match) {
  const config = loadConfig();
  if (!config.controlChannel) {
    console.warn('Aucun salon de controle configure (/salon-admin) : confirmation non envoyee.');
    return;
  }

  let type = null;
  try {
    type = require('../startgg/tournament').detectType(row.name);
  } catch {
    // Nom non reconnu comme une weekly connue : on affiche sans le type.
  }

  const pending = loadPending();
  pending[row.rowNumber] = {
    kind: 'announce',
    name: row.name,
    url: match.url,
    published: match.published,
    games: row.games,
    type,
    startAt: match.startAt ?? null,
    timezone: match.timezone ?? null,
    createdAt: new Date().toISOString(),
  };
  savePending(pending);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`announce:${row.rowNumber}`).setLabel('Oui, annoncer').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`skip:${row.rowNumber}`).setLabel('Non').setStyle(ButtonStyle.Secondary),
  );

  const { formatFrenchDate } = require('./announce');
  const dateStr = match.startAt ? formatFrenchDate(new Date(match.startAt * 1000), match.timezone) : null;

  const channel = await client.channels.fetch(config.controlChannel);
  await channel.send({
    content:
      `🔎 **${row.name}** existe déjà sur start.gg${match.published ? '' : ' (pas encore publié)'}` +
      `${dateStr ? ` — ${dateStr}` : ''} : ${match.url}\n` +
      `Je fais l'annonce de cette weekly ?`,
    components: [buttons],
  });
}

async function handleAnnounceButton(interaction, rowNumber, confirmed) {
  const pending = loadPending();
  const entry = pending[rowNumber];
  if (!entry) {
    await interaction.reply({ content: 'Cette confirmation a deja ete traitee.', flags: MessageFlags.Ephemeral });
    return;
  }
  delete pending[rowNumber];
  savePending(pending);

  // Accuser reception tout de suite : Discord invalide l'interaction au bout
  // de 3s, et l'envoi de l'annonce peut depasser ce delai.
  await interaction.deferUpdate();
  const baseContent = interaction.message.content;

  if (!confirmed) {
    await interaction.editReply({ content: `${baseContent}\n\n❌ Annonce annulée.`, components: [] });
    return;
  }

  const { announce, weeklyAnnouncement } = require('./announce');
  const content = weeklyAnnouncement({
    type: entry.type,
    date: entry.startAt ? new Date(entry.startAt * 1000) : null,
    timezone: entry.timezone,
    games: entry.games,
    url: entry.url,
  });

  try {
    await announce(interaction.client, content);
    await interaction.editReply({ content: `${baseContent}\n\n✅ Annoncé.`, components: [] });
  } catch (err) {
    console.error(`Annonce echouee pour "${entry.name}":`, err.message);
    await interaction.editReply({ content: `${baseContent}\n\n❌ Échec de l'annonce : ${err.message}`, components: [] });
  }
}

// --- "Faut-il lancer la creation de ce tournoi ?" ----------------------------

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction  Deja deferree.
 * @param {{ rowNumber: number, name: string, date: Date, games: string[] }} row
 */
async function askCreateConfirmation(interaction, row) {
  const pending = loadPending();
  pending[row.rowNumber] = {
    kind: 'create',
    name: row.name,
    date: row.date.toISOString(),
    games: row.games,
    createdAt: new Date().toISOString(),
  };
  savePending(pending);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`create-yes:${row.rowNumber}`).setLabel('Oui, créer').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`create-no:${row.rowNumber}`).setLabel('Non').setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({
    content:
      `📅 Prochain tournoi sans page start.gg : **${row.name}** le ${row.date.toLocaleDateString('fr-FR')} ` +
      `(**${row.games.join(', ') || 'jeux non precises'}**)\n` +
      `Je lance la création ?`,
    components: [buttons],
  });
}

async function handleCreateButton(interaction, rowNumber, confirmed) {
  const pending = loadPending();
  const entry = pending[rowNumber];
  if (!entry) {
    await interaction.reply({ content: 'Cette confirmation a deja ete traitee.', flags: MessageFlags.Ephemeral });
    return;
  }
  delete pending[rowNumber];
  savePending(pending);

  await interaction.deferUpdate();
  const baseContent = interaction.message.content;

  if (!confirmed) {
    await interaction.editReply({ content: `${baseContent}\n\n❌ Création annulée.`, components: [] });
    return;
  }

  await interaction.editReply({ content: `${baseContent}\n\n⏳ Création en cours...`, components: [] });

  const tournament = require('../startgg/tournament');
  const { announce, successMessage, warningMessage } = require('./announce');

  const row = { rowNumber: Number(rowNumber), name: entry.name, date: new Date(entry.date), games: entry.games };

  try {
    const result = await tournament.createTournamentForRow(row);
    if (!result.url) throw new Error('Creation reussie mais aucune URL retournee par start.gg.');

    await announce(interaction.client, result.approximateMatch ? warningMessage(result) : successMessage(result));
    await interaction.editReply({ content: `${baseContent}\n\n✅ Créé et annoncé : ${result.url}`, components: [] });
  } catch (err) {
    console.error(`Creation manuelle echouee pour "${row.name}":`, err.message);
    await interaction.editReply({ content: `${baseContent}\n\n❌ Échec de la création : ${err.message}`, components: [] });
  }
}

// --- Aiguillage --------------------------------------------------------------

function isConfirmationButton(customId) {
  return /^(announce|skip|create-yes|create-no):/.test(customId);
}

async function handleConfirmationButton(interaction) {
  const [action, rowNumber] = interaction.customId.split(':');

  if (action === 'create-yes' || action === 'create-no') {
    return handleCreateButton(interaction, rowNumber, action === 'create-yes');
  }
  return handleAnnounceButton(interaction, rowNumber, action === 'announce');
}

module.exports = { askConfirmation, askCreateConfirmation, isConfirmationButton, handleConfirmationButton };
