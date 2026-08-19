// Point d'entree du bot : connexion Discord, enregistrement des commandes
// slash, demarrage de la verification quotidienne automatique.

const path = require('path');
const fs = require('fs');
const { ENV_FILE } = require('./paths');

require('dotenv').config({ path: ENV_FILE });

const { Client, GatewayIntentBits, Collection, REST, Routes, MessageFlags } = require('discord.js');
const cronJob = require('./cron');
const { isConfirmationButton, handleConfirmationButton } = require('./discord/confirm');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) {
  console.error('DISCORD_TOKEN / DISCORD_CLIENT_ID manquants (voir .env.example).');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsDir = path.join(__dirname, 'discord', 'commands');
const commandData = [];
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  client.commands.set(command.data.name, command);
  commandData.push(command.data.toJSON());
}

client.once('clientReady', async () => {
  console.log(`Connecte en tant que ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    console.log(`${commandData.length} commande(s) slash enregistree(s).`);
  } catch (err) {
    console.error('Enregistrement des commandes echoue:', err.message);
  }

  cronJob.start(client);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && isConfirmationButton(interaction.customId)) {
    try {
      await handleConfirmationButton(interaction);
    } catch (err) {
      console.error(`Bouton ${interaction.customId} a plante:`, err);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Commande /${interaction.commandName} a plante:`, err);
    const payload = {
      content: "Une erreur est survenue lors de l'execution de la commande.",
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
    else await interaction.reply(payload);
  }
});

client.login(token);
