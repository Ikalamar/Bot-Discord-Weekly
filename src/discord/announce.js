// Mise en forme et envoi des annonces dans les salons configures.

const { loadConfig } = require('../config-store');

async function announce(client, content) {
  const config = loadConfig();
  const channelIds = config.discordChannels || [];
  if (channelIds.length === 0) {
    console.warn('Aucun salon configure (/set-channel) : annonce non envoyee.');
    return;
  }

  for (const channelId of channelIds) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) await channel.send(content);
    } catch (err) {
      console.error(`Envoi Discord echoue sur le salon ${channelId}:`, err.message);
    }
  }
}

function roleMention() {
  const config = loadConfig();
  return config.weeklyRoleId ? `<@&${config.weeklyRoleId}> ` : '';
}

// "Dimanche 17 aout". La date doit venir de start.gg et non du sheet : si le
// tournoi a ete cree ou ajuste a la main, c'est la seule source fiable.
function formatFrenchDate(date, timezone) {
  if (!date) return null;
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone || 'Europe/Paris',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Format unique des annonces, partage par la creation automatique et la
 * confirmation manuelle, pour que les deux ne divergent pas.
 * @param {{ type: string, date: Date|null, timezone: string|null, games: string[], url: string }} params
 */
function weeklyAnnouncement({ type, date, timezone, games, url }) {
  const dateLine = date ? `${formatFrenchDate(date, timezone)}\n` : '';
  return (
    `||${roleMention()}|| \n` +
    `# ${type || 'Weekly'}\n` +
    dateLine +
    `\n` +
    (games && games.length ? `**${games.join(', ')}**\n` : '') +
    url
  );
}

function successMessage(result) {
  return weeklyAnnouncement({
    type: result.type,
    date: result.startAt || null,
    timezone: result.timezone,
    // Repli sur un modele partiel : on annonce les jeux reellement presents.
    games: result.approximateMatch ? result.matchedKey.split(',') : result.requestedGames,
    url: result.url,
  });
}

function manualFallbackMessage(row, error) {
  return (
    `⚠️ **Création automatique impossible pour "${row.name}"** (${error.message})\n` +
    `À créer à la main :\n` +
    `1. https://www.start.gg/create/tournament\n` +
    `2. "Copy settings from a previous tournament" → choisir la dernière édition du même type\n` +
    `3. Nom : **${row.name}** — Date : **${row.date.toLocaleDateString('fr-FR')}** — Jeux : **${row.games.join(', ')}**\n` +
    `4. Colle le lien créé en réponse à ce message`
  );
}

module.exports = {
  announce,
  weeklyAnnouncement,
  successMessage,
  manualFallbackMessage,
  formatFrenchDate,
  roleMention,
};
