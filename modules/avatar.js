// modules/avatar.js
import { auth } from './firebase.js';

export const AVATAR_OPTIONS = {
    top: [
        { v: "bigHair", l: "Pelo Largo" }, { v: "bob", l: "Corte Bob" }, { v: "bun", l: "Moño" },
        { v: "curly", l: "Rizado" }, { v: "curvy", l: "Ondulado" }, { v: "dreads", l: "Rastas" },
        { v: "frida", l: "Frida" }, { v: "frizzle", l: "Encrespado" }, { v: "fro", l: "Afro" },
        { v: "hat", l: "Gorra" }, { v: "hijab", l: "Hiyab" }, { v: "longButNotTooLong", l: "Media Melena" },
        { v: "shaggy", l: "Despeinado" }, { v: "shortFlat", l: "Corto Liso" }, { v: "shortRound", l: "Corto Redondo" },
        { v: "turban", l: "Turbante" }, { v: "winterHat1", l: "Gorro Invierno" }, { v: "noHair", l: "Calvo" }
    ],
    accessories: [
        { v: "none", l: "Ninguno" }, { v: "eyepatch", l: "Parche" }, { v: "kurt", l: "Kurt" },
        { v: "prescription01", l: "Gafas 1" }, { v: "prescription02", l: "Gafas 2" },
        { v: "round", l: "Redondas" }, { v: "sunglasses", l: "Sol" }, { v: "wayfarers", l: "Wayfarers" }
    ],
    hairColor: [
        { v: "2c1b18", l: "Negro" }, { v: "4a312c", l: "Castaño Oscuro" }, { v: "724133", l: "Castaño" },
        { v: "a55728", l: "Pelirrojo" }, { v: "b58143", l: "Rubio Oscuro" }, { v: "d6b370", l: "Rubio" },
        { v: "ecdcbf", l: "Platino" }, { v: "f59797", l: "Rosa" }, { v: "e8e1e1", l: "Canoso" }
    ],
    facialHair: [
        { v: "none", l: "Ninguno" }, { v: "beardLight", l: "Barba Corta" }, { v: "beardMajestic", l: "Barba Larga" },
        { v: "beardMedium", l: "Barba Media" }, { v: "moustacheFancy", l: "Bigote Curvo" }, { v: "moustacheMagnum", l: "Bigote Magnum" }
    ],
    clothing: [
        { v: "blazerAndShirt", l: "Americana y Camisa" }, { v: "blazerAndSweater", l: "Americana y Jersey" },
        { v: "collarAndSweater", l: "Jersey con Cuello" }, { v: "graphicShirt", l: "Camiseta con Logo" },
        { v: "hoodie", l: "Sudadera" }, { v: "overall", l: "Peto" }, { v: "shirtCrewNeck", l: "Camiseta Cuello Redondo" },
        { v: "shirtVNeck", l: "Camiseta Cuello V" }
    ],
    clothesColor: [
        { v: "262e33", l: "Negro" }, { v: "65c9ff", l: "Azul Cielo" }, { v: "5199e4", l: "Azul Real" },
        { v: "25557c", l: "Azul Marino" }, { v: "e6e6e6", l: "Gris Claro" }, { v: "929598", l: "Gris" },
        { v: "3c4f5c", l: "Gris Carbón" }, { v: "b1e2ff", l: "Azul Pastel" }, { v: "a7ffc4", l: "Verde Menta" },
        { v: "ffde55", l: "Amarillo" }, { v: "ffafc9", l: "Rosa" }, { v: "ff5c5c", l: "Rojo" }, { v: "ffffff", l: "Blanco" }
    ],
    skinColor: [
        { v: "614335", l: "Muy Oscuro" }, { v: "ae5d29", l: "Oscuro" }, { v: "d08b5b", l: "Bronceado" },
        { v: "edb98a", l: "Trigueño" }, { v: "fd9841", l: "Moreno" }, { v: "f8d25c", l: "Amarillo" }, { v: "ffdbb4", l: "Pálido" }
    ],
    eyes: [
        { v: "default", l: "Normal" }, { v: "closed", l: "Cerrados" }, { v: "cry", l: "Llorando" },
        { v: "eyeRoll", l: "Ojos Arriba" }, { v: "happy", l: "Feliz" }, { v: "hearts", l: "Corazones" },
        { v: "side", l: "Mirada Lateral" }, { v: "squint", l: "Entrecerrados" }, { v: "surprised", l: "Sorprendido" },
        { v: "wink", l: "Guiño" }
    ],
    mouth: [
        { v: "default", l: "Normal" }, { v: "concerned", l: "Preocupado" }, { v: "disbelief", l: "Incrédulo" },
        { v: "eating", l: "Comiendo" }, { v: "grimace", l: "Mueca" }, { v: "sad", l: "Triste" },
        { v: "screamOpen", l: "Gritando" }, { v: "serious", l: "Serio" }, { v: "smile", l: "Sonrisa" },
        { v: "tongue", l: "Lengua fuera" }
    ],
    accessoriesColor: [
        { v: "262e33", l: "Negro" }, { v: "65c9ff", l: "Azul Cielo" }, { v: "5199e4", l: "Azul Real" },
        { v: "25557c", l: "Azul Marino" }, { v: "e6e6e6", l: "Gris Claro" }, { v: "929598", l: "Gris" },
        { v: "3c4f5c", l: "Gris Carbón" }, { v: "b1e2ff", l: "Azul Pastel" }, { v: "a7ffc4", l: "Verde Menta" },
        { v: "ffde55", l: "Amarillo" }, { v: "ffafc9", l: "Rosa" }, { v: "ff5c5c", l: "Rojo" }, { v: "ffffff", l: "Blanco" }
    ],
    facialHairColor: [
        { v: "262e33", l: "Negro" }, { v: "4a312c", l: "Castaño Oscuro" }, { v: "724133", l: "Castaño" },
        { v: "a55728", l: "Pelirrojo" }, { v: "b58143", l: "Rubio" }, { v: "c0a183", l: "Platino" },
        { v: "e8e1e1", l: "Canoso" }
    ],
    eyebrows: [
        { v: "default", l: "Normal" }, { v: "angry", l: "Enfadado" }, { v: "flatNatural", l: "Planas" },
        { v: "raisedExcited", l: "Excitas" }, { v: "sadConcerned", l: "Triste" }, { v: "unibrowNatural", l: "Entrecejo" },
        { v: "upDown", l: "Asimétricas" }
    ]
};

export const ALEXA_WORDS = [
    "MELON", "SANDIA", "GUITARRA", "PIANO", "RADIO", "DISCO", "CEBRA", "TIGRE", 
    "LUNA", "SOL", "ESTRELLA", "NUBE", "PLAYA", "MONTE", "RIO", "MAR", 
    "BARCO", "TREN", "FLOR", "ARBOL", "CASA", "LIBRO", "PULPO", "GATO", 
    "PERRO", "AVION", "COCHE", "MESA", "SILLA", "RELOJ", "DADO", "LLAVE", 
    "PUERTA", "VENTANA", "QUESO", "PAN", "LECHE", "MIEL", "LAGO", "BOSQUE"
];

export function generateSecretWord() {
    return ALEXA_WORDS[Math.floor(Math.random() * ALEXA_WORDS.length)];
}

export function initAvatarSelects(avatarSelects, updateFn) {
    Object.keys(AVATAR_OPTIONS).forEach(key => {
        const select = avatarSelects[key];
        if (!select) return;
        
        select.innerHTML = AVATAR_OPTIONS[key].map(opt => 
            `<option value="${opt.v}">${opt.l}</option>`
        ).join('');
        
        select.addEventListener('change', updateFn);
    });
}

export function updateAvatarPreview(avatarSelects, avatarPreview) {
    const user = auth.currentUser;
    if (!user) return;

    const params = new URLSearchParams({
        seed: user.uid
    });
    
    Object.keys(avatarSelects).forEach(key => {
        const val = avatarSelects[key].value;
        if (val && val !== 'none') {
            params.append(key, val);
            if (key === 'accessories') params.set('accessoriesProbability', 100);
            if (key === 'facialHair') params.set('facialHairProbability', 100);
            if (key === 'top') params.set('topProbability', 100);
        } else if (val === 'none') {
            if (key === 'accessories') params.set('accessoriesProbability', 0);
            if (key === 'facialHair') params.set('facialHairProbability', 0);
            if (key === 'top') params.set('topProbability', 0);
        }
    });

    const url = `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
    if (avatarPreview) avatarPreview.src = url;
    return url;
}
