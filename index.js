const { Client, GatewayIntentBits, PermissionsBitField, Partials } = require('discord.js');
const fs = require('fs');
const { DateTime } = require('luxon'); // Import de luxon

// Fichier de logs
const LOG_FILE = './logs.json';
let logs = [];

// Charger les logs existants si le fichier existe
try {
    if (fs.existsSync(LOG_FILE)) {
        const savedLogs = fs.readFileSync(LOG_FILE, 'utf8');
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
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
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
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel], // Permet de gérer les DMs partiels
});

// Token de ton bot
const token = "MTMxODk3MzA3ODY3OTg1MTA3OA.GfxxsF.YtbmHzeCbTPzIAshlp8QBSllRLccF0E9JwCqB4";


// Charger le fichier des rappels
const REMINDERS_FILE = './reminders.json';
let reminders;

try {
    reminders = fs.existsSync(REMINDERS_FILE) ? JSON.parse(fs.readFileSync(REMINDERS_FILE)) : {};
} catch (error) {
    console.error(`Erreur lors du chargement du fichier reminders.json : ${error.message}`);
    reminders = {}; // Initialise un objet vide si une erreur se produit
}

function saveReminders() {
    try {
        fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
        console.log("Rappels sauvegardés !");
    } catch (error) {
        console.error(`Erreur lors de la sauvegarde de reminders.json : ${error.message}`);
    }
}

// Constantes
const FIRST_DELAY = 3 * 60 * 1000; // 3 jours en millisecondes
const SECOND_DELAY = 5 * 60 * 1000; // 5 jours supplémentaires en millisecondes

// Quand le bot est prêt
client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag} !`);
});

// Fonction pour obtenir la date au format dd-MM-yyyy et l'heure de Paris
function getFormattedDate() {
    return DateTime.now().setZone('Europe/Paris').toFormat('dd-MM-yyyy HH:mm:ss');
}

// Événement : Un nouveau membre rejoint
client.on('guildMemberAdd', (member) => {
    console.log(`${member.user.tag} a rejoint le serveur.`);

    // Ajouter un log pour ce membre dès qu'un message est envoyé
    logs.push({
        id: member.id,
        username: member.user.username,
        date: getFormattedDate(),  // Utilise la nouvelle fonction
        messageType: "Arrivée sur le serveur"
    });
    saveLogs();

    // // Envoyer un message privé
    // member.send(`Salut ${member.user.username} , c’est Passions Jobs ! 👋\n\nOn a vu que tu n’as pas encore rejoint complètement notre serveur...`)
    //     .then(() => console.log(`Premier message envoyé à ${member.user.tag}`))
    //     .catch(err => console.error(`Impossible d’envoyer un MP à ${member.user.tag} : ${err}`));
    
    // Programmer un rappel dans 3 jours
    const firstReminder = Date.now() + FIRST_DELAY;
    reminders[member.id] = { firstReminder, secondReminder: firstReminder + SECOND_DELAY };
    saveReminders();

    // Planifier le premier rappel
    setTimeout(() => checkRoles(member, true), FIRST_DELAY);
});

// Vérifier les rôles d'un membre
function checkRoles(member, isFirstReminder) {
    const hasRoles = member.roles.cache.size > 1; // Exclut le rôle @everyone

    if (!hasRoles) {
        // Envoyer un message privé
        member.send(`Salut ${member.user.username} , c’est Passions Jobs ! 👋

On a vu que tu n’as pas encore rejoint complètement notre serveur, du coup tu n’as pas accès à nos conseils pour t’aider dans ta recherche d’emploi. Est-ce que tu as bien reçu le formulaire pour t’inscrire ?`)
            .then(() => console.log(`Premier message envoyé à ${member.user.tag}`))
            .catch(err => console.error(`Impossible d’envoyer un MP à ${member.user.tag} : ${err}`));

        if (isFirstReminder) {
            // Planifier le second rappel
            setTimeout(() => checkRoles(member, false), SECOND_DELAY - FIRST_DELAY);
        }
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
client.on('guildMemberRemove', (member) => {
    console.log(`${member.user.tag} a quitté le serveur.`);
    // Supprimer les rappels associés
    if (reminders[member.id]) {
        delete reminders[member.id];
        saveReminders();
    }
});

// Commande : !check-norole
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Commande : !check-norole
    if (message.content === '!check-norole') {
        // Vérifie si l'utilisateur a les permissions nécessaires
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("🚫 Vous n'avez pas la permission d'utiliser cette commande.");
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

Nous avons remarqué que tu n'as pas encore de rôle sur le serveur **${guild.name}**. Si tu veux accéder à toutes les fonctionnalités et ressources, pense à compléter les étapes nécessaires ! 😊`);

                        // Ajouter un log pour chaque message envoyé via la commande
                        logs.push({
                            id: member.id,
                            username: member.user.username,
                            date: getFormattedDate(),  // Utilise la nouvelle fonction
                            messageType: "Commande !check-norole"
                        });
                        console.log(`Message envoyé à ${member.user.tag}`);
                    } catch (err) {
                        console.error(`Impossible d'envoyer un message à ${member.user.tag} : ${err.message}`);
                    }
                }
            }

            // Sauvegarder les logs après envoi des messages
            saveLogs();

            // Répondre avec le nombre de membres contactés
            message.channel.send(`🔍 Vérification terminée : ${count} membres sans rôle ont été contactés.`);
        } catch (error) {
            console.error('Erreur lors de la vérification des membres :', error);
            message.channel.send('❌ Une erreur est survenue lors de la vérification des membres.');
        }
    }
});

// Commande : !logs
client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    // Commande : !logs
    if (message.content === '!logs') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("🚫 Vous n'avez pas la permission d'utiliser cette commande.");
        }

        if (logs.length > 0) {
            const logMessages = logs.map(log => `${log.username} (${log.id}) - ${log.date} - Type: ${log.messageType}`).join("\n");
            message.channel.send(`Voici les logs des messages envoyés :\n\n${logMessages}`);
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
                "Tu dois me dire quoi dire ! Exemple : `!say Bonjour`",
            );
        }
        message.channel.send(text);
    }

    // Commande : !help
    // Vérifie que le message n'est pas envoyé par un bot
    if (message.author.bot) return;

    if (message.content === "!help") {
        try {
            // Envoie le message d'aide en DM
            await message.author.send("Voici les commandes disponibles :\n\n- `!help` : Affiche ce message d'aide.\n- `!ticket` : Crée un ticket pour demander de l'aide.");
            
            // Répond dans le chat pour confirmer l'envoi
            message.channel.send(`${message.author}, je t'ai envoyé le message d'aide en DM ! 📬`);
        } catch (error) {
            console.error("Erreur lors de l'envoi du DM :", error);
            // Si le bot ne peut pas envoyer de DM (par exemple, si les DMs sont fermés)
            message.channel.send(`${message.author}, je ne peux pas t'envoyer de DM. Vérifie que tes messages privés sont activés.`);
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
    if (message.guild === null) {
    console.log(`Message privé reçu de ${message.author.tag}: ${message.content}`);

    if (message.content.toLowerCase().includes("ticket")) {
        try {
            const guild = client.guilds.cache.get('809422974036869180'); // ID du serveur
            if (!guild) {
                message.reply("Je n'ai pas pu trouver le serveur. Veuillez vérifier la configuration.");
                return;
            }

            const category = guild.channels.cache.get('1319599460497625110'); // ID de la catégorie
            if (!category) {
                message.reply("Désolé, le système de tickets est actuellement désactivé.");
                return;
            }

            const ticketChannel = await guild.channels.create({
                name: `ticket-${message.author.username}`,
                type: 0, // Salon textuel
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: ['ViewChannel'],
                    },
                    {
                        id: message.author.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                    },
                    {
                        id: client.user.id, // Permissions pour le bot
                        allow: ['ViewChannel', 'SendMessages', 'ManageMessages'],
                    },
                ],
            });

            await ticketChannel.send({
                content: `Salut <@${message.author.id}> ! Un modérateur <@&1318948441295949917> va bientôt répondre à ton ticket.`,
            });

            message.reply(`Ton ticket a été créé avec succès ! Un modérateur te répondra bientôt dans ton canal privé.`);

        } catch (err) {
            console.error("Erreur lors de la création du ticket :", err);
            message.reply("Désolé, une erreur est survenue lors de la création du ticket.");
        }
    }
}

});

// Connecter le bot
client.login(token);