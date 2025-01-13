require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
var Airtable = require("airtable");
const { DateTime } = require("luxon"); // Import de luxon
const axios = require("axios");

// Configuration d'Airtable
const airtableApiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_TABLE_NAME;
const tableId = process.env.AIRTABLE_TABLE_ID;
var base = new Airtable({ apiKey: airtableApiKey }).base(baseId);

// URL de l'API Airtable
const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;

(async () => {
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${airtableApiKey}`, // Authentification avec le token
      },
    });

    if (response.data.records.length > 0) {
      console.log(
        "Champs disponibles dans la table :",
        Object.keys(response.data.records[0].fields)
      );
    } else {
      console.log(
        "La table est vide. Ajoute un enregistrement pour tester les champs."
      );
    }
  } catch (err) {
    console.error("Erreur d'accès à Airtable :", err);
  }
})();

// Fichier de logs
const LOG_FILE = "./logs.json";
let logs = [];

// Charger les logs existants si le fichier existe
try {
  if (fs.existsSync(LOG_FILE)) {
    const savedLogs = fs.readFileSync(LOG_FILE, "utf8");
    logs = JSON.parse(savedLogs);
    if (!Array.isArray(logs)) {
      logs = []; // Assurer que logs est un tableau
    }
  }
} catch (error) {
  console.error(`Erreur lors du chargement des logs : ${error.message}`);
  logs = []; // En cas d'erreur, réinitialiser logs
}

// Fonction pour sauvegarder les logs
function saveLogs() {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
    console.log("Logs sauvegardés dans logs.json !");
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde des logs : ${error.message}`);
  }
}

// Créer un client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel], // Permet de gérer les DMs partiels
});

// Token de ton bot
const token = process.env.BOT_TOKEN;

// Charger le fichier des rappels
const REMINDERS_FILE = "./reminders.json";
let reminders;

try {
  reminders = fs.existsSync(REMINDERS_FILE)
    ? JSON.parse(fs.readFileSync(REMINDERS_FILE))
    : {};
} catch (error) {
  console.error(
    `Erreur lors du chargement du fichier reminders.json : ${error.message}`
  );
  reminders = {}; // Initialise un objet vide si une erreur se produit
}

function saveReminders() {
  try {
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
    console.log("Rappels sauvegardés !");
  } catch (error) {
    console.error(
      `Erreur lors de la sauvegarde de reminders.json : ${error.message}`
    );
  }
}

// Constantes
const FIRST_DELAY = 3 * 24 * 60 * 60 * 1000; // 3 jours en millisecondes
// const SECOND_DELAY = 5 * 24 * 60 * 60 * 1000; // 5 jours supplémentaires en millisecondes

// Quand le bot est prêt
client.once("ready", () => {
  console.log(`Connecté en tant que ${client.user.tag} !`);
});

// Fonction pour obtenir la date au format dd-MM-yyyy et l'heure de Paris
function getFormattedDate() {
  return DateTime.now().setZone("Europe/Paris").toFormat("dd-MM-yyyy HH:mm:ss");
}

// Événement : Un nouveau membre rejoint
client.on("guildMemberAdd", (member) => {
  console.log(`${member.user.tag} a rejoint le serveur.`);

  // Ajouter un log pour ce membre dès qu'un message est envoyé
  logs.push({
    id: member.id,
    username: member.user.username,
    date: getFormattedDate(), // Utilise la nouvelle fonction
    messageType: "Arrivée sur le serveur",
  });
  saveLogs();

  // Programmer un rappel dans 3 jours
  const firstReminder = Date.now() + FIRST_DELAY;
  reminders[member.id] = {
    firstReminder,
    secondReminder: firstReminder + SECOND_DELAY,
  };
  saveReminders();

  // Planifier le premier rappel
  setTimeout(() => checkRoles(member, true), FIRST_DELAY);
});

// Vérifier les rôles d'un membre
function checkRoles(member, isFirstReminder) {
  const hasRoles = member.roles.cache.size > 1; // Exclut le rôle @everyone

  if (!hasRoles) {
    // Envoyer un message privé
    member
      .send(
        `Salut ${member.user.username} , c’est Passions Jobs ! 👋

On a vu que tu n’as pas encore rejoint complètement notre serveur, du coup tu n’as pas accès à nos conseils pour t’aider dans ta recherche d’emploi. Est-ce que tu as bien reçu le formulaire pour t’inscrire ?

Si besoin, je suis là pour t’aider ! Tu n'as qu'a écrire "!help"🚀`
      )
      .then(() => console.log(`Premier message envoyé à ${member.user.tag}`))
      .catch((err) =>
        console.error(
          `Impossible d’envoyer un MP à ${member.user.tag} : ${err}`
        )
      );

    // if (isFirstReminder) {
    //     // Planifier le second rappel
    //     setTimeout(() => checkRoles(member, false), SECOND_DELAY - FIRST_DELAY);
    // }
  } else if (!isFirstReminder) {
    console.log(`${member.user.tag} a obtenu un rôle entre-temps.`);
  }

  // Nettoyer les rappels après vérification
  if (!isFirstReminder || hasRoles) {
    delete reminders[member.id];
    saveReminders();
  }
}

// Événement : Un membre quitte le serveur
client.on("guildMemberRemove", (member) => {
  console.log(`${member.user.tag} a quitté le serveur.`);
  // Supprimer les rappels associés
  if (reminders[member.id]) {
    delete reminders[member.id];
    saveReminders();
  }
});

// Gestion des commandes en DM
client.on("messageCreate", async (message) => {
  if (message.content.toLowerCase().includes("!postuler")) {
    console.log(`Message reçu de ${message.author.tag}: ${message.content}`);
    // Supprimer le message "!postuler"
    try {
      message.delete();
      console.log(`Message "!postuler" de ${message.author.tag} supprimé.`);
    } catch (err) {
      console.error("Erreur lors de la suppression du message :", err);
    }

    try {
      const guild = client.guilds.cache.get("1291657071443443784"); // ID du serveur 809422974036869180
      if (!guild) {
        message.reply(
          "Je n'ai pas pu trouver le serveur. Veuillez vérifier la configuration."
        );
        return;
      }

      const category = guild.channels.cache.get("1324788064622739486"); // ID de la catégorie 1324328256597397585
      if (!category) {
        message.reply(
          "Désolé, le système de postulation est actuellement désactivé."
        );
        return;
      }

      const postulationChannel = await guild.channels.create({
        name: `postulation-${message.author.username}`,
        type: 0, // Salon textuel
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ["ViewChannel"],
          },
          {
            id: message.author.id,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
          },
          {
            id: client.user.id, // Permissions pour le bot
            allow: ["ViewChannel", "SendMessages", "ManageMessages"],
          },
        ],
      });

      // Message d'avertissement
      await postulationChannel.send(
        `⚠️ Attention : Ce salon sera automatiquement supprimé après 1 heure, vous pourrez en ouvrir un à nouveau une fois celui-ci fermé.`
      );

      // Définir un minuteur pour supprimer le salon après 1 heure
      const salonTimer = setTimeout(async () => {
        if (postulationChannel && postulationChannel.deletable) {
          await postulationChannel.delete(
            "Salon fermé après expiration du délai."
          );
          console.log(
            `Le salon ${postulationChannel.name} a été supprimé automatiquement.`
          );
        }
      }, 60 * 60 * 1000); // 1 heure en millisecondes

      let continueLoop = true; // Contrôle de la boucle

      // Étape 1 : Envoyer un message avec un bouton
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("validate")
          .setLabel("Valider")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("quitter")
          .setLabel("Quitter")
          .setStyle(ButtonStyle.Danger)
      );
      while (continueLoop) {
        await postulationChannel.send({
          content: `Salut <@${message.author.id}> ! Cliquez sur le bouton ci-dessous pour valider votre participation.`,
          components: [row], // Ajout du bouton
        });

        // Étape 2 : Attendre que l'utilisateur clique sur le bouton

        const buttonFilter = (interaction) =>
          ["validate", "quitter"].includes(interaction.customId) &&
          interaction.user.id === message.author.id;
        try {
          // Vérifie si le salon est valide avant d'attendre l'interaction
          if (!postulationChannel || postulationChannel.deleted) {
            console.error("Le salon a été supprimé ou n'existe plus.");
            await message.author.send(
              "Le salon de postulation a été fermé. Veuillez réessayer."
            );
            return; // Arrêter le processus si le salon est supprimé
          }
          try {
            const interaction = await postulationChannel.awaitMessageComponent({
              filter: buttonFilter,
            });

            // L'utilisateur a cliqué sur le bouton
            if (interaction.customId === "validate") {
              await interaction.reply(
                "📄 Veuillez envoyer votre fichier PDF ici."
              );

              // Étape 3 : Collecter le fichier PDF
              const pdfAttachment = await collectAttachment(
                postulationChannel,
                message.author
              );

              if (!pdfAttachment) {
                await postulationChannel.send(
                  "🔄 Réessayons. Veuillez envoyer un fichier PDF valide."
                );
                continue; // Relance la boucle
              }

              // Étape 4 : Enregistrer dans Airtable
              try {
                await base(tableId).create({
                  "ID Discord du membre": message.author.id,
                  "PDF de l'offre": [{ url: pdfAttachment.url }],
                });

                await postulationChannel.send(
                  "✅ Merci ! Les informations ont été enregistrées avec succès dans notre base de données."
                );
              } catch (error) {
                console.error("Erreur lors de l'ajout à Airtable :", error);
                await postulationChannel.send(
                  "❌ Une erreur est survenue lors de l'enregistrement des données. Veuillez réessayer."
                );
                continue; // Relancer la boucle
              }
              // Étape 5 : Demander si l'utilisateur veut recommencer
              const confirmationRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("recommencer")
                  .setLabel("Recommencer")
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId("quitter")
                  .setLabel("Quitter")
                  .setStyle(ButtonStyle.Danger)
              );

              await postulationChannel.send({
                content: "Souhaitez-vous recommencer ou quitter ?",
                components: [confirmationRow],
              });
              const confirmationFilter = (interaction) =>
                ["recommencer", "quitter"].includes(interaction.customId) &&
                interaction.user.id === message.author.id;

              const confirmationInteraction =
                await postulationChannel.awaitMessageComponent({
                  filter: confirmationFilter,
                });

              if (confirmationInteraction.customId === "recommencer") {
                await confirmationInteraction.reply(
                  "🔄 D'accord, relançons le processus !"
                );
                continue; // Revenir au début de la boucle
              } else if (confirmationInteraction.customId === "quitter") {
                await confirmationInteraction
                  .reply("👋 Merci pour votre postulation. À bientôt !")
                  .then(() => {
                    setTimeout(async () => {
                      postulationChannel.delete().catch((err) => {
                        console.error(
                          "Erreur lors de la suppression du chanel :",
                          err
                        );
                        message.channel.send(
                          "Je n'ai pas pu fermer ce chanel. Vérifie mes permissions."
                        );
                      });
                    }, 5000); // 5 secondes avant suppression
                  });
                continueLoop = false; // Quitter la boucle
              }
            } else if (interaction.customId === "quitter") {
              await interaction
                .reply("👋 Merci pour votre postulation. À bientôt !")
                .then(() => {
                  setTimeout(async () => {
                    postulationChannel.delete().catch((err) => {
                      console.error(
                        "Erreur lors de la suppression du chanel :",
                        err
                      );
                      message.channel.send(
                        "Je n'ai pas pu fermer ce chanel. Vérifie mes permissions."
                      );
                    });
                  }, 5000); // 5 secondes avant suppression
                });
              continueLoop = false; // Quitter la boucle
            }
            //304 const interaction
          } catch (error) {
            // Si l'utilisateur n'a pas cliqué dans le délai imparti
            console.error("Aucune interaction détectée :", error);
          }
          //295 dessous
        } catch (err) {
          console.error("Erreur inattendue :", err);
          await message.author.send(
            "Une erreur inattendue s'est produite. Veuillez réessayer."
          );
        }
      }
      //const guild 217
    } catch (err) {
      console.error("Erreur lors de la création du salon :", err);
      message.reply(
        "Désolé, une erreur est survenue lors de la création du salon."
      );
    }
  }
});

// Fonction pour collecter une pièce jointe
async function collectAttachment(postulationChannel, user) {
  return new Promise((resolve) => {
    const filter = (msg) => {
      return msg.author?.id === user.id && msg.attachments.size > 0;
    };

    const collector = postulationChannel.createMessageCollector({
      filter,
      max: 1,
      time: 60000,
    });

    collector.on("collect", (msg) => {
      const attachment = msg.attachments.first();
      if (attachment?.contentType === "application/pdf") {
        resolve(attachment);
      } else {
        resolve(null);
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) resolve(null);
    });
  });
}

// Commande : !check-norole
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // Commande : !check-norole
  if (message.content === "!check-norole") {
    // Vérifie si l'utilisateur a les permissions nécessaires
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply(
        "🚫 Vous n'avez pas la permission d'utiliser cette commande."
      );
    }

    try {
      const guild = message.guild; // Le serveur où la commande est exécutée
      const members = await guild.members.fetch(); // Récupère tous les membres du serveur
      let count = 0;

      for (const [id, member] of members) {
        // Ignore les bots
        if (member.user.bot) continue;

        // Vérifie si le membre n'a aucun rôle (à part @everyone)
        const hasNoRoles = member.roles.cache.size === 1;

        if (hasNoRoles) {
          count++;

          // Essaye d'envoyer un message privé
          try {
            await member.send(`Salut ${member.user.username} 👋,

Nous avons remarqué que tu n'as pas encore de rôle sur le serveur **${guild.name}**. Si tu veux accéder à toutes les fonctionnalités et ressources, pense à compléter le formulaire ! 

Si tu as besoin d'aide je reste disponible 😊. Tu n'as qu'a écrire "!help"`);

            // Ajouter un log pour chaque message envoyé via la commande
            logs.push({
              id: member.id,
              username: member.user.username,
              date: getFormattedDate(), // Utilise la nouvelle fonction
              messageType: "Commande !check-norole",
            });
            console.log(`Message envoyé à ${member.user.tag}`);
          } catch (err) {
            console.error(
              `Impossible d'envoyer un message à ${member.user.tag} : ${err.message}`
            );
          }
        }
      }

      // Sauvegarder les logs après envoi des messages
      saveLogs();

      // Répondre avec le nombre de membres contactés
      message.channel.send(
        `🔍 Vérification terminée : ${count} membres sans rôle ont été contactés.`
      );
    } catch (error) {
      console.error("Erreur lors de la vérification des membres :", error);
      message.channel.send(
        "❌ Une erreur est survenue lors de la vérification des membres."
      );
    }
  }
});

// Commande : !logs
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  // Commande : !logs
  if (message.content === "!logs") {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply(
        "🚫 Vous n'avez pas la permission d'utiliser cette commande."
      );
    }

    if (logs.length > 0) {
      const logMessages = logs
        .map(
          (log) =>
            `${log.username} (${log.id}) - ${log.date} - Type: ${log.messageType}`
        )
        .join("\n");
      message.channel.send(
        `Voici les logs des messages envoyés :\n\n${logMessages}`
      );
    } else {
      message.channel.send("Aucun message n'a encore été envoyé.");
    }
  }
});

// Répondre à des messages avec des commandes
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Commande : !ping
  if (message.content === "!ping") {
    message.channel.send("Pong ! 🏓");
  }

  // Commande : !hello
  if (message.content === "!hello") {
    message.channel.send("Salut, bienvenue ! 😊");
  }

  // Commande : !say
  if (message.content.startsWith("!say")) {
    const args = message.content.split(" ").slice(1);
    const text = args.join(" ");
    if (!text) {
      return message.channel.send(
        "Tu dois me dire quoi dire ! Exemple : `!say Bonjour`"
      );
    }
    message.channel.send(text);
  }

  //Commande : !link
  if (message.content === "!link") {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply(
        "🚫 Vous n'avez pas la permission d'utiliser cette commande."
      );
    }
    message.channel.send("https://tally.so/r/n0JxdQ");
  }

  // Vérifie que le message est dans un serveur et non en DM

  // Vérifie que la commande est bien !close
  if (message.content.toLowerCase() === "!close") {
    // Vérifie si le salon appartient à un ticket
    if (
      message.channel.name.startsWith("ticket-") ||
      message.channel.name.startsWith("postulation-")
    ) {
      // Confirme la suppression du salon
      await message.channel
        .send("Le chanel sera fermé dans 5 secondes.")
        .then(() => {
          setTimeout(() => {
            message.channel.delete().catch((err) => {
              console.error("Erreur lors de la suppression du chanel :", err);
              message.channel.send(
                "Je n'ai pas pu fermer ce chanel. Vérifie mes permissions."
              );
            });
          }, 5000); // 5 secondes avant suppression
        });
    } else {
      // Si la commande est utilisée dans un salon qui n'est pas un ticket
      message.reply("Vous ne pouvez pas fermer ce salon avec cette commande.");
    }
  }

  // Commande : !help
  // Vérifie que le message n'est pas envoyé par un bot
  if (message.author.bot) return;

  if (message.content === "!help") {
    try {
      // Envoie le message d'aide en DM
      await message.author.send(
        "Voici les commandes disponibles :\n\n- `!help` : Affiche ce message d'aide.\n- `!ticket` : Crée un ticket sur le serveur pour demander de l'aide."
      );

      // Répond dans le chat pour confirmer l'envoi
      message.channel.send(
        `${message.author}, je t'ai envoyé le message d'aide en DM ! 📬`
      );
    } catch (error) {
      console.error("Erreur lors de l'envoi du DM :", error);
      // Si le bot ne peut pas envoyer de DM (par exemple, si les DMs sont fermés)
      message.channel.send(
        `${message.author}, je ne peux pas t'envoyer de DM. Vérifie que tes messages privés sont activés.`
      );
    }
  }

  if (message.author.bot) return; // Ignore les messages du bot

  // Vérifie si le message est partiel (non chargé)
  if (message.partial) {
    try {
      await message.fetch(); // Charge le message
    } catch (err) {
      console.error("Impossible de charger le message partiel : ", err);
      return;
    }
  }

  // Vérifier si le message vient d'un DM (message privé)
  // if (message.guild === null) {

  if (message.content.toLowerCase().includes("!ticket")) {
    console.log(`Message reçu de ${message.author.tag}: ${message.content}`);
    try {
      const guild = client.guilds.cache.get("1291657071443443784"); // ID du serveur 809422974036869180
      if (!guild) {
        message.reply(
          "Je n'ai pas pu trouver le serveur. Veuillez vérifier la configuration."
        );
        return;
      }

      const category = guild.channels.cache.get("1320682977914650624"); // ID de la catégorie 1319599460497625110
      if (!category) {
        message.reply(
          "Désolé, le système de tickets est actuellement désactivé."
        );
        return;
      }

      const ticketChannel = await guild.channels.create({
        name: `ticket-${message.author.username}`,
        type: 0, // Salon textuel
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ["ViewChannel"],
          },
          {
            id: message.author.id,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
          },
          {
            id: client.user.id, // Permissions pour le bot
            allow: ["ViewChannel", "SendMessages", "ManageMessages"],
          },
        ],
      });

      await ticketChannel.send({
        content: `Salut <@${message.author.id}> ! Un modérateur <@&1318948441295949917> va bientôt répondre à ton ticket.`,
      });

      message.reply(
        `Ton ticket a été créé avec succès ! Un modérateur te répondra bientôt dans ton canal privé.`
      );
    } catch (err) {
      console.error("Erreur lors de la création du ticket :", err);
      message.reply(
        "Désolé, une erreur est survenue lors de la création du ticket."
      );
    }
  }
  // }
});

// Connecter le bot
client.login(token);
