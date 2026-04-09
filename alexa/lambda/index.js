const Alexa = require('ask-sdk-core');
const admin = require('firebase-admin');
// const levenshtein = require('levenshtein-edit-distance'); // Eliminado por incompatibilidad
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
// IMPORTANTE: Sustituye el contenido de 'serviceAccount' por el JSON de tu cuenta de servicio.
const serviceAccount = require("./service-account.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// --- LÓGICA DE JUEGO ---
const GAME_ROUNDS = 10;

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log("Iniciando LaunchRequest");
        const speakOutput = '¡Bienvenido a Reto Musical! Para empezar a jugar, dime tu PIN de cuatro dígitos.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Dime el PIN de tu lista para empezar.')
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

const PinIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PinIntent';
    },
    async handle(handlerInput) {
        let pin = Alexa.getSlotValue(handlerInput.requestEnvelope, 'pin');
        
        console.log("PIN recibido de Alexa:", pin);
        if (pin) pin = pin.replace(/\s/g, '');
        console.log("PIN procesado:", pin);

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        try {
            console.log(`Buscando en colección 'pins' el documento: ${pin}`);
            const pinDoc = await db.collection('pins').doc(pin).get();
            
            if (!pinDoc.exists) {
                console.log(`PIN ${pin} no encontrado en la colección 'pins'`);
                return handlerInput.responseBuilder
                    .speak(`No he encontrado ningún usuario con el PIN ${pin}. Asegúrate de que es el código de 4 dígitos de tu perfil.`)
                    .reprompt('Dime un PIN válido.')
                    .getResponse();
            }

            const uid = pinDoc.data().uid;
            console.log(`UID encontrado para el PIN: ${uid}`);
            
            if (!uid) {
                console.error("El documento del PIN existe pero no tiene campo 'uid'");
                throw new Error("UID missing in pin doc");
            }

            // 2. Obtener datos del usuario
            console.log(`Buscando en colección 'users' el documento: ${uid}`);
            const userDoc = await db.collection('users').doc(uid).get();
            if (!userDoc.exists) {
                 console.log(`Usuario ${uid} no encontrado en la colección 'users'`);
                 return handlerInput.responseBuilder
                    .speak('He encontrado el PIN pero no tu perfil de usuario. Contacta con soporte.')
                    .getResponse();
            }
            const userData = userDoc.data();
            console.log("Datos de usuario recuperados:", userData.displayName);

            // 3. Buscar la primera playlist de este usuario
            console.log(`Buscando playlists para ownerUid: ${uid}`);
            const playlistsQuery = await db.collection('playlists')
                .where('ownerUid', '==', uid)
                .limit(1)
                .get();
            
            if (playlistsQuery.empty) {
                console.log(`No se encontraron playlists para el usuario ${uid}`);
                return handlerInput.responseBuilder
                    .speak(`Hola ${userData.displayName || ''}. He encontrado tu perfil, pero no tienes ninguna lista creada. Crea una en la web para jugar.`)
                    .getResponse();
            }

            const playlistData = playlistsQuery.docs[0].data();
            console.log(`Playlist cargada: ${playlistData.title}`);

            sessionAttributes.pendingPlaylist = {
                pin: pin,
                url: playlistData.url,
                title: playlistData.title,
                secretWord: (userData.secretWord || "").toLowerCase(),
                displayName: userData.displayName
            };

            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            return handlerInput.responseBuilder
                .speak(`Hola ${userData.displayName || ''}. He cargado tu lista "${playlistData.title}". Por seguridad, dime ahora tu palabra clave de acceso.`)
                .reprompt('Dime la palabra clave que aparece en tu perfil web.')
                .getResponse();

        } catch (error) {
            console.error("ERROR DETALLADO en PinIntentHandler:", error);
            // Mensaje más específico para el desarrollador en logs
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
        const secretWordValue = Alexa.getSlotValue(handlerInput.requestEnvelope, 'secret_word').toLowerCase();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const pending = sessionAttributes.pendingPlaylist;

        if (!pending || secretWordValue !== pending.secretWord) {
            return handlerInput.responseBuilder
                .speak('Esa no es la palabra clave correcta. Inténtalo de nuevo.')
                .reprompt('Dime la palabra clave correcta.')
                .getResponse();
        }

        // Acceso concedido
        sessionAttributes.currentPlaylist = pending;
        delete sessionAttributes.pendingPlaylist;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(`Acceso concedido. ¿Qué quieres adivinar? ¿La canción o el cantante?`)
            .reprompt('Dime: adivinar canción o adivinar cantante.')
            .getResponse();
    }
};

const GameModeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GameModeIntent';
    },
    async handle(handlerInput) {
        const mode = Alexa.getSlotValue(handlerInput.requestEnvelope, 'mode'); // 'canción' o 'cantante'
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        sessionAttributes.gameMode = mode.includes('canción') ? 'title' : 'artist';
        sessionAttributes.score = 0;
        sessionAttributes.currentRound = 0;
        
        // Cargar tracks desde la URL de la playlist
        try {
            let apiUrl = sessionAttributes.currentPlaylist.url;
            
            // Si es una URL web de Deezer, extraer el ID y convertir a URL de API
            const deezerMatch = apiUrl.match(/playlist\/(\d+)/);
            if (deezerMatch) {
                apiUrl = `https://api.deezer.com/playlist/${deezerMatch[1]}`;
            }

            console.log(`Pidiendo canciones a: ${apiUrl}`);
            const response = await axios.get(apiUrl);
            
            let trackList = [];
            if (response.data && response.data.tracks && response.data.tracks.data) {
                // Formato Deezer API
                trackList = response.data.tracks.data;
            } else if (response.data && Array.isArray(response.data)) {
                // Formato genérico
                trackList = response.data;
            } else if (response.data && response.data.tracks && Array.isArray(response.data.tracks)) {
                // Formato heredado
                trackList = response.data.tracks;
            }

            // Mapear al formato que espera el juego y filtrar los que no tienen preview de audio
            sessionAttributes.tracks = trackList.map(t => ({
                title: t.title,
                artist: t.artist ? (t.artist.name || t.artist) : 'Desconocido',
                preview: t.preview
            })).filter(t => t.preview);
            
            if (sessionAttributes.tracks.length === 0) {
                throw new Error("No se encontraron canciones con preview de audio en la lista.");
            }

            // Barajar
            sessionAttributes.tracks.sort(() => Math.random() - 0.5);
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            return startNextRound(handlerInput);
        } catch (e) {
            console.error(`Error cargando playlist: ${e.message}`);
            return handlerInput.responseBuilder
                .speak('No he podido cargar las canciones de esta lista. Asegúrate de que la URL sea válida o que la lista en Deezer sea pública.')
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
        const userAnswer = Alexa.getSlotValue(handlerInput.requestEnvelope, 'answer').toLowerCase();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const currentTrack = sessionAttributes.tracks[sessionAttributes.currentRound];
        
        const target = sessionAttributes.gameMode === 'title' ? currentTrack.title : currentTrack.artist;
        const distance = levenshtein(userAnswer, target.toLowerCase());
        
        let feedback = '';
        if (distance <= 3) { // Margen de error aceptable
            sessionAttributes.score += 10;
            feedback = `¡Correcto! Era ${target}.`;
        } else {
            feedback = `Casi, pero no. Era ${target}.`;
        }

        sessionAttributes.currentRound++;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        if (sessionAttributes.currentRound >= Math.min(GAME_ROUNDS, sessionAttributes.tracks.length)) {
            return handlerInput.responseBuilder
                .speak(`${feedback} Fin del juego. Tu puntuación final es de ${sessionAttributes.score} puntos. ¡Hasta pronto!`)
                .withShouldEndSession(true)
                .getResponse();
        }

        return startNextRound(handlerInput, feedback);
    }
};

function startNextRound(handlerInput, prefix = '') {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const track = sessionAttributes.tracks[sessionAttributes.currentRound];
    
    // Alexa SSML exige HTTPS y formato específico. Las URLs de Deezer suelen ser compatibles.
    const audioUrl = track.preview; 
    const speech = `${prefix} Ronda ${sessionAttributes.currentRound + 1}. Escucha: <audio src="${audioUrl}" /> ¿Cómo se llama?`;

    return handlerInput.responseBuilder
        .speak(speech)
        .reprompt('Dime el nombre o el artista según el modo.')
        .getResponse();
}

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('Dime tu PIN para empezar a jugar.')
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
                Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('¡Adiós!')
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
            .speak('No tengo nada que repetir. ¿Cuál es el PIN de tu lista?')
            .reprompt('Dime tu PIN para empezar.')
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Lo siento, no sé como ayudarte con eso. Intenta decir ayuda para más opciones.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const ErrorHandler = {
    canHandle() { return true; },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
        return handlerInput.responseBuilder
            .speak('Perdona, no te he entendido. ¿Puedes repetirlo?')
            .reprompt('No te he entendido.')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        PinIntentHandler,
        SecretWordIntentHandler,
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
