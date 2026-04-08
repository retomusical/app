const Alexa = require('ask-sdk-core');
const admin = require('firebase-admin');
const levenshtein = require('levenshtein-edit-distance');
const axios = require('axios');

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
        const speakOutput = '¡Bienvenido a Reto Musical! Para empezar a jugar, dime tu PIN de cuatro dígitos.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Dime el PIN de tu lista para empezar.')
            .getResponse();
    }
};

const PinIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PinIntent';
    },
    async handle(handlerInput) {
        const pin = Alexa.getSlotValue(handlerInput.requestEnvelope, 'pin');
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        try {
            const playlistDoc = await db.collection('playlists').doc(pin.toUpperCase()).get();
            
            if (!playlistDoc.exists) {
                return handlerInput.responseBuilder
                    .speak(`No he encontrado ninguna lista con el PIN ${pin}. Inténtalo de nuevo.`)
                    .reprompt('Dime un PIN válido.')
                    .getResponse();
            }

            const playlistData = playlistDoc.data();
            const ownerUid = playlistData.ownerUid;
            
            // Buscamos al dueño para validar la palabra secreta (2FA)
            const userDoc = await db.collection('users').doc(ownerUid).get();
            const userData = userDoc.data();

            sessionAttributes.pendingPlaylist = {
                pin: pin.toUpperCase(),
                url: playlistData.url,
                title: playlistData.title,
                secretWord: userData.secretWord.toLowerCase()
            };

            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            return handlerInput.responseBuilder
                .speak(`He cargado la lista "${playlistData.title}". Por seguridad, dime ahora la palabra clave de acceso.`)
                .reprompt('Dime la palabra clave que aparece en tu perfil web.')
                .getResponse();

        } catch (error) {
            console.error(error);
            return handlerInput.responseBuilder
                .speak('Lo siento, ha habido un problema al conectar con la base de datos.')
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
            const response = await axios.get(sessionAttributes.currentPlaylist.url);
            sessionAttributes.tracks = response.data.tracks || [];
            
            // Barajar
            sessionAttributes.tracks.sort(() => Math.random() - 0.5);
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            return startNextRound(handlerInput);
        } catch (e) {
            return handlerInput.responseBuilder
                .speak('No he podido cargar las canciones de esta lista.')
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
        CancelAndStopIntentHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
