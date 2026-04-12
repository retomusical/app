const Alexa = require('ask-sdk-core');
const admin = require('firebase-admin');
const axios = require('axios');

// --- ALGORITMO DE LEVENSHTEIN LOCAL ---
function levenshtein(a, b) {
    if (!a || !b) return 100;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[b.length][a.length];
}

// --- CONFIGURACIÓN FIREBASE ---
const serviceAccount = require("./service-account.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// --- LÓGICA DE JUEGO ---
const GAME_ROUNDS = 10;

const HELP_MESSAGE = 'Estas son tus opciones: 1. Listar las listas que tengo. 2. Añadir una lista de un amigo diciendo el pin. 3. Escoger una lista. 4. Jugar. 5. Pedir ayuda. Y 6. Salir. ¿Qué te gustaría hacer?';

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log("Iniciando LaunchRequest");
        const speakOutput = '¡Bienvenido a Reto Musical! Para empezar a jugar, dime tu PIN de cuatro dígitos.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Dime el PIN de tu perfil para empezar.')
            .getResponse();
    }
};

const PinIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PinIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (sessionAttributes.authenticated) {
            return handlerInput.responseBuilder
                .speak('Ya estás identificado. Puedes decir ayuda para escuchar el menú de opciones.')
                .reprompt(HELP_MESSAGE)
                .getResponse();
        }

        let pin = Alexa.getSlotValue(handlerInput.requestEnvelope, 'pin');
        
        console.log("PIN recibido de Alexa:", pin);
        if (pin) pin = pin.replace(/\s/g, '');

        try {
            const pinDoc = await db.collection('pins').doc(pin).get();
            
            if (!pinDoc.exists) {
                return handlerInput.responseBuilder
                    .speak(`No he encontrado ningún usuario con el PIN ${pin}. Asegúrate de que es el código de 4 dígitos de tu perfil.`)
                    .reprompt('Dime un PIN válido.')
                    .getResponse();
            }

            const uid = pinDoc.data().uid;
            
            if (!uid) {
                throw new Error("UID missing in pin doc");
            }

            const userDoc = await db.collection('users').doc(uid).get();
            if (!userDoc.exists) {
                 return handlerInput.responseBuilder
                    .speak('He encontrado el PIN pero no tu perfil de usuario. Contacta con soporte.')
                    .getResponse();
            }
            const userData = userDoc.data();

            sessionAttributes.pendingUser = {
                uid: uid,
                secretWord: (userData.secretWord || "").toLowerCase(),
                displayName: userData.displayName
            };

            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            return handlerInput.responseBuilder
                .speak(`Hola ${userData.displayName || ''}. Por seguridad, di tu palabra clave precedida de "la clave es". Por ejemplo: "la clave es rosa".`)
                .reprompt('Di la clave es, seguido de tu palabra. Por ejemplo: la clave es rosa.')
                .getResponse();

        } catch (error) {
            console.error("ERROR DETALLADO en PinIntentHandler:", error);
            return handlerInput.responseBuilder
                .speak('Lo siento, ha habido un problema al conectar con la base de datos de Firebase. Revisa los logs de CloudWatch.')
                .getResponse();
        }
    }
};

const SecretWordIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SecretWordIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const pending = sessionAttributes.pendingUser;

        console.log("SecretWordIntent recibido. pendingUser:", JSON.stringify(pending));

        // Si no hay sesión de login pendiente (no se dijo el PIN antes)
        if (!pending) {
            return handlerInput.responseBuilder
                .speak('Antes de la palabra clave necesito que me digas tu PIN de cuatro dígitos.')
                .reprompt('Dime tu PIN para empezar.')
                .getResponse();
        }

        const rawSlot = Alexa.getSlotValue(handlerInput.requestEnvelope, 'secret_word');
        console.log("Slot secret_word recibido (raw):", rawSlot);

        if (!rawSlot) {
            return handlerInput.responseBuilder
                .speak('No he entendido la palabra clave. Por favor, dímela de nuevo.')
                .reprompt('Dime tu palabra clave de acceso.')
                .getResponse();
        }

        const secretWordValue = rawSlot.toLowerCase().trim();
        console.log("Palabra clave normalizada:", secretWordValue, "| Esperada:", pending.secretWord);

        if (secretWordValue !== pending.secretWord) {
            return handlerInput.responseBuilder
                .speak('Esa no es la palabra clave correcta. Inténtalo de nuevo.')
                .reprompt('Dime la palabra clave correcta.')
                .getResponse();
        }

        // Acceso concedido
        sessionAttributes.authenticated = true;
        sessionAttributes.user = pending;
        delete sessionAttributes.pendingUser;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        console.log("Login exitoso para:", pending.displayName);

        return handlerInput.responseBuilder
            .speak(`Acceso concedido. Puedes escuchar tus listas, añadir la de un amigo con su pin, elegir una lista o jugar. Si necesitas ayuda con el menú, di "ayuda". ¿Qué quieres hacer?`)
            .reprompt('¿Qué quieres hacer? Puedes decir "ayuda".')
            .getResponse();
    }
};


const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
               Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (!sessionAttributes.authenticated) {
            return handlerInput.responseBuilder
                .speak('Dime tu PIN para empezar a jugar.')
                .reprompt('Dime el PIN.')
                .getResponse();
        }
        return handlerInput.responseBuilder
            .speak(HELP_MESSAGE)
            .reprompt(HELP_MESSAGE)
            .getResponse();
    }
};

const ListPlaylistsIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ListPlaylistsIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (!sessionAttributes.authenticated) {
            return handlerInput.responseBuilder.speak('Dime tu PIN primero.').getResponse();
        }

        try {
            const uid = sessionAttributes.user.uid;
            const playlistsQuery = await db.collection('playlists').where('ownerUid', '==', uid).get();
            
            if (playlistsQuery.empty) {
                return handlerInput.responseBuilder
                    .speak('No tienes ninguna lista. Puedes añadir una de un amigo diciendo su pin, o crear una en la web. ¿Qué quieres hacer?')
                    .reprompt('¿Qué quieres hacer?')
                    .getResponse();
            }

            let listsInfo = [];
            let speech = `Tienes ${playlistsQuery.size} listas: `;
            
            playlistsQuery.forEach((doc, index) => {
                const data = doc.data();
                listsInfo.push({ title: data.title, url: data.url });
                speech += `${index + 1}. ${data.title}. `;
            });

            sessionAttributes.userPlaylists = listsInfo;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            
            speech += 'Para escoger una, di "escoger la lista" seguido del número. ¿Cuál quieres?';

            return handlerInput.responseBuilder
                .speak(speech)
                .reprompt('Di "escoger la lista" y el número para seleccionar una.')
                .getResponse();
        } catch (error) {
            console.error(error);
            return handlerInput.responseBuilder.speak('Hubo un error al buscar tus listas.').getResponse();
        }
    }
};

const AddFriendPlaylistIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddFriendPlaylistIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (!sessionAttributes.authenticated) {
            return handlerInput.responseBuilder.speak('Dime tu PIN primero.').getResponse();
        }

        let pin = Alexa.getSlotValue(handlerInput.requestEnvelope, 'pin');
        if (pin) pin = pin.replace(/\s/g, '');

        try {
            const pinDoc = await db.collection('pins').doc(pin).get();
            if (!pinDoc.exists) {
                return handlerInput.responseBuilder
                    .speak(`No he encontrado un amigo con el PIN ${pin}. ¿Te gustaría hacer otra cosa?`)
                    .reprompt('¿Qué quieres hacer?')
                    .getResponse();
            }

            const uid = pinDoc.data().uid;
            
            const userDoc = await db.collection('users').doc(uid).get();
            let userName = 'tu amigo';
            if (userDoc.exists && userDoc.data().displayName) {
                 userName = userDoc.data().displayName;
            }

            const playlistsQuery = await db.collection('playlists').where('ownerUid', '==', uid).get();
            
            if (playlistsQuery.empty) {
                return handlerInput.responseBuilder
                    .speak(`${userName} no tiene listas creadas. ¿Qué quieres hacer ahora?`)
                    .reprompt('¿Qué quieres hacer?')
                    .getResponse();
            }

            let listsInfo = [];
            let speech = `He encontrado a ${userName}. Tiene ${playlistsQuery.size} listas: `;
            
            playlistsQuery.forEach((doc, index) => {
                const data = doc.data();
                listsInfo.push({ title: data.title, url: data.url });
                speech += `${index + 1}. ${data.title}. `;
            });

            sessionAttributes.userPlaylists = listsInfo;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            
            speech += 'Para escoger una de ellas de forma temporal, di "escoger la lista" y el número.';

            return handlerInput.responseBuilder
                .speak(speech)
                .reprompt('Di "escoger la lista" y el número para cargarla.')
                .getResponse();
        } catch (error) {
            console.error(error);
            return handlerInput.responseBuilder.speak('Hubo un error al buscar a tu amigo.').getResponse();
        }
    }
};

const ChoosePlaylistIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ChoosePlaylistIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (!sessionAttributes.authenticated) {
            return handlerInput.responseBuilder.speak('Dime tu PIN primero.').getResponse();
        }

        if (!sessionAttributes.userPlaylists || sessionAttributes.userPlaylists.length === 0) {
            return handlerInput.responseBuilder
                .speak('Primero debes listar tus listas o añadir a un amigo. Di ayuda para opciones.')
                .reprompt('¿Qué quieres hacer?')
                .getResponse();
        }

        const numStr = Alexa.getSlotValue(handlerInput.requestEnvelope, 'playlistNumber');
        const num = parseInt(numStr, 10);

        if (isNaN(num) || num < 1 || num > sessionAttributes.userPlaylists.length) {
            return handlerInput.responseBuilder
                .speak('El número que has dicho no corresponde a ninguna lista de las que te leí. Escoge otro.')
                .reprompt('Di escoger la lista y el número.')
                .getResponse();
        }

        const selected = sessionAttributes.userPlaylists[num - 1];
        sessionAttributes.currentPlaylist = selected;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(`Has seleccionado la lista "${selected.title}". Puedes decir "jugar" para empezar la partida.`)
            .reprompt('Di jugar para empezar o salir si prefieres marcharte.')
            .getResponse();
    }
};

const PlayIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PlayIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (!sessionAttributes.authenticated) {
            return handlerInput.responseBuilder.speak('Dime tu PIN primero.').getResponse();
        }

        if (!sessionAttributes.currentPlaylist) {
            return handlerInput.responseBuilder
                .speak('Antes de jugar tienes que seleccionar una lista. Primero listemos tus opciones. Di "listar mis listas".')
                .reprompt('¿Qué quieres hacer?')
                .getResponse();
        }

        return handlerInput.responseBuilder
            .speak('¡Genial! ¿A qué quieres jugar en esta lista? ¿Adivinar canciones o cantantes?')
            .reprompt('Dime: canciones o cantantes.')
            .getResponse();
    }
};

const GameModeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GameModeIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (!sessionAttributes.authenticated) return handlerInput.responseBuilder.speak('Dime tu PIN primero.').getResponse();
        
        if (!sessionAttributes.currentPlaylist) {
            return handlerInput.responseBuilder
                .speak('Primero tienes que seleccionar una lista. Di "mis listas" y luego "seleccionar la uno".')
                .getResponse();
        }

        const mode = Alexa.getSlotValue(handlerInput.requestEnvelope, 'mode');
        sessionAttributes.gameMode = mode.includes('canción') ? 'title' : 'artist';
        sessionAttributes.score = 0;
        sessionAttributes.currentRound = 0;
        
        try {
            let apiUrl = sessionAttributes.currentPlaylist.url;
            const deezerMatch = apiUrl.match(/playlist\/(\d+)/);
            if (deezerMatch) {
                apiUrl = `https://api.deezer.com/playlist/${deezerMatch[1]}`;
            }

            const response = await axios.get(apiUrl);
            let trackList = [];
            if (response.data && response.data.tracks && response.data.tracks.data) {
                trackList = response.data.tracks.data;
            } else if (response.data && Array.isArray(response.data)) {
                trackList = response.data;
            } else if (response.data && response.data.tracks && Array.isArray(response.data.tracks)) {
                trackList = response.data.tracks;
            }

            sessionAttributes.tracks = trackList.map(t => ({
                title: t.title,
                artist: t.artist ? (t.artist.name || t.artist) : 'Desconocido',
                preview: t.preview
            })).filter(t => t.preview);
            
            if (sessionAttributes.tracks.length === 0) {
                throw new Error("No preview available");
            }

            // Shuffle
            sessionAttributes.tracks.sort(() => Math.random() - 0.5);
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            return startNextRound(handlerInput);
        } catch (e) {
            console.error(`Error cargando playlist: ${e.message}`);
            return handlerInput.responseBuilder
                .speak('Hubo un problema intentando cargar las canciones de esta lista. Prueba elegir otra lista diciendo "mis listas".')
                .reprompt('¿Qué te gustaría hacer?')
                .getResponse();
        }
    }
};

const AnswerIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AnswerIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (!sessionAttributes.tracks) {
             return handlerInput.responseBuilder
                .speak('No estamos en medio de un juego. Prueba diciendo "jugar" o "ayuda".')
                .reprompt('¿Qué quieres hacer?')
                .getResponse();
        }

        const userAnswer = Alexa.getSlotValue(handlerInput.requestEnvelope, 'answer').toLowerCase();
        const currentTrack = sessionAttributes.tracks[sessionAttributes.currentRound];
        
        const target = sessionAttributes.gameMode === 'title' ? currentTrack.title : currentTrack.artist;
        const distance = levenshtein(userAnswer, target.toLowerCase());
        
        let feedback = '';
        if (distance <= 3) {
            sessionAttributes.score += 10;
            feedback = `¡Correcto! Era ${target}.`;
        } else {
            feedback = `Casi, pero no. Era ${target}.`;
        }

        sessionAttributes.currentRound++;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        if (sessionAttributes.currentRound >= Math.min(GAME_ROUNDS, sessionAttributes.tracks.length)) {
            // Fin del juego, reinicia estado para nueva partida
            sessionAttributes.tracks = null;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            return handlerInput.responseBuilder
                .speak(`${feedback} Fin de la partida. Has conseguido ${sessionAttributes.score} puntos. Puedes probar con otra lista, ver el menú o salir. ¿Qué decides?`)
                .reprompt('¿Qué quieres hacer ahora? Puedes ver el menú.')
                .getResponse();
        }

        return startNextRound(handlerInput, feedback, true);
    }
};

function startNextRound(handlerInput, prefix = '', waitAnswer = true) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const track = sessionAttributes.tracks[sessionAttributes.currentRound];
    const audioUrl = track.preview; 
    const speech = `${prefix} Ronda ${sessionAttributes.currentRound + 1}. Escucha: <audio src="${audioUrl}" /> ¿Cómo se llama?`;

    return handlerInput.responseBuilder
        .speak(speech)
        .reprompt('Dime cómo se llama según el modo seleccionado.')
        .getResponse();
}

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
                Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        // Si estamos en medio del login (esperando la palabra clave), no cerrar la sesión.
        // Es probable que la palabra clave del usuario coincida con un sample de Stop/Cancel.
        if (sessionAttributes.pendingUser) {
            console.log("Stop/Cancel recibido durante login, ignorando y pidiendo palabra clave.");
            return handlerInput.responseBuilder
                .speak('Recuerda que necesito que me digas tu palabra clave. Di "la clave es" seguido de tu palabra.')
                .reprompt('Di la clave es, seguido de tu palabra secreta.')
                .getResponse();
        }

        return handlerInput.responseBuilder
            .speak('¡Gracias por jugar a Reto Musical! Me despido, ¡hasta pronto!')
            .withShouldEndSession(true)
            .getResponse();
    }
};

const RepeatIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.RepeatIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (sessionAttributes.tracks && sessionAttributes.tracks[sessionAttributes.currentRound]) {
            return startNextRound(handlerInput);
        }
        return handlerInput.responseBuilder
            .speak('No tengo ninguna canción pendiente por repetir. ¿Qué más quieres hacer?')
            .reprompt('Di "ayuda" para el menú.')
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        // Si estamos esperando la palabra clave, dar instrucciones precisas
        if (sessionAttributes.pendingUser) {
            console.log("Fallback recibido durante login, redirigiendo a pedir palabra clave.");
            return handlerInput.responseBuilder
                .speak('No he captado lo que has dicho. Recuerda decir "la clave es" seguido de tu palabra secreta. Por ejemplo: "la clave es rosa".')
                .reprompt('Di la clave es, seguido de tu palabra secreta.')
                .getResponse();
        }

        // Si no estamos autenticados aún, pedir el PIN
        if (!sessionAttributes.authenticated) {
            return handlerInput.responseBuilder
                .speak('No te he entendido. Para empezar, dime tu PIN. Por ejemplo: "mi pin es 1234".')
                .reprompt('Dime tu PIN de cuatro dígitos.')
                .getResponse();
        }

        const speakOutput = 'Lo siento, no sé cómo ayudarte con eso. Intenta decir "ayuda" para ver las opciones disponibles en el menú.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() { return true; },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
        return handlerInput.responseBuilder
            .speak('Perdona, ha ocurrido un error o no te he entendido bien. ¿Qué te gustaría hacer? Puedes pedir "ayuda".')
            .reprompt('Dime "ayuda" para ver el menú.')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        PinIntentHandler,
        SecretWordIntentHandler,
        ListPlaylistsIntentHandler,
        AddFriendPlaylistIntentHandler,
        ChoosePlaylistIntentHandler,
        PlayIntentHandler,
        GameModeIntentHandler,
        AnswerIntentHandler,
        HelpIntentHandler,
        RepeatIntentHandler,
        FallbackIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
