// app.js - Phase 2: Game Logic & Music Integration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { MusicAPI } from "./api.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- Utilities ---
const cleanSongTitle = (str) => {
    if (!str) return "";
    return str.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/, ' ').trim();
};

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const panelSection = document.getElementById('panel-section');
const gameSection = document.getElementById('game-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-display-name');
const userPinDisplay = document.getElementById('user-pin');
const newPlaylistName = document.getElementById('new-playlist-name');
const newPlaylistUrl = document.getElementById('new-playlist-url');
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const myPlaylistsList = document.getElementById('my-playlists-list');

const friendPinInput = document.getElementById('friend-pin-input');
const loadFriendBtn = document.getElementById('load-friend-btn');
const activePlaylistInfo = document.getElementById('active-playlist-info');
const activePlaylistOwner = document.getElementById('active-playlist-owner');
const resetToMineBtn = document.getElementById('reset-to-mine-btn');

// Game UI Elements
const gameStatus = document.getElementById('game-status');
const audioPlayer = document.getElementById('audio-player');
const answerInput = document.getElementById('answer-input');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const nextTrackBtn = document.getElementById('next-track-btn');
const timeLeftDisplay = document.getElementById('time-left');
const scoreDisplay = document.getElementById('score-display');
const gameModeLabel = document.getElementById('game-mode-label');
const roundIndicator = document.getElementById('round-indicator');
const resultMessage = document.getElementById('result-message');
const resultText = document.getElementById('result-text');
const correctAnswerIs = document.getElementById('correct-answer-is');
const feedbackIcon = document.getElementById('feedback-icon');

// Multiplayer UI Elements
const classModeEntryBtn = document.getElementById('class-mode-entry-btn');
const classModeSection = document.getElementById('class-mode-section');
const backFromClassBtn = document.getElementById('back-from-class');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinRoomPinInput = document.getElementById('join-room-pin');
const hostSection = document.getElementById('host-section');
const hostPinDisplay = document.getElementById('host-pin-display');
const hostPlayerList = document.getElementById('host-player-list');
const playerCountBadge = document.getElementById('player-count');
const startClassGameBtn = document.getElementById('start-class-game-btn');
const hostGameControls = document.getElementById('host-game-controls');
const hostNextRoundBtn = document.getElementById('host-next-round-btn');
const playerSection = document.getElementById('player-section');
const playerWaiting = document.getElementById('player-waiting');
const playerGame = document.getElementById('player-game');
const playerAnswerInput = document.getElementById('player-answer-input');
const playerSubmitBtn = document.getElementById('player-submit-btn');
const playerFeedback = document.getElementById('player-feedback');

// Settings Elements
const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsNameInput = document.getElementById('settings-name-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const themeDots = document.querySelectorAll('.theme-dot');
const customColorInput = document.getElementById('custom-theme-color');

// --- State ---
let currentUser = null;
let currentPlaylist = {
    url: "",
    ownerName: "Mí",
    sharePin: "",
    title: ""
};

let gameState = {
    tracks: [],
    currentIndex: 0,
    score: 0,
    mode: 'title', // 'title' or 'artist'
    timer: null,
    isPlaying: false
};

// --- Authentication Logic ---

onAuthStateChanged(auth, async (user) => {
    console.log("Estado de auth cambiado:", user ? "Usuario logueado" : "Sin usuario");
    if (user) {
        currentUser = user;
        try {
            await handleUserAuthenticated(user);
        } catch (error) {
            console.error("Error al procesar usuario autenticado:", error);
        }
    } else {
        currentUser = null;
        showSection('login');
    }
});

loginBtn.addEventListener('click', async () => {
    console.log("Iniciando login con Popup...");
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error detallado de Firebase Auth:", error);
        showNotification("Error al iniciar sesión: " + error.message, "error");
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

async function handleUserAuthenticated(user) {
    userNameDisplay.textContent = user.displayName;
    
    // Check if user exists in Firestore
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        userPinDisplay.textContent = userData.pin;
    } else {
        // New user: Generate Alexa PIN
        const pin = await generateUniquePin();
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            pin: pin,
            createdAt: new Date().toISOString()
        };
        
        await setDoc(userRef, userData);
        await setDoc(doc(db, "pins", pin), { uid: user.uid });
        userPinDisplay.textContent = pin;
    }
    
    await loadMyPlaylists();
    showSection('panel');
}

async function generateUniqueLetterPin() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let pin;
    let isUnique = false;
    
    while (!isUnique) {
        pin = '';
        for (let i = 0; i < 4; i++) {
            pin += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const pinSnap = await getDoc(doc(db, "playlists", pin));
        if (!pinSnap.exists()) {
            isUnique = true;
        }
    }
    return pin;
}

async function generateUniquePin() {
    let pin;
    let isUnique = false;
    
    while (!isUnique) {
        // Generate random 4 digit string
        pin = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Check in pins collection
        const pinSnap = await getDoc(doc(db, "pins", pin));
        if (!pinSnap.exists()) {
            isUnique = true;
        }
    }
    return pin;
}

// --- Database Logic ---

// --- Playlist Management Logic ---

async function loadMyPlaylists() {
    const q = query(collection(db, "playlists"), where("ownerUid", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    myPlaylistsList.innerHTML = "";
    
    if (querySnapshot.empty) {
        myPlaylistsList.innerHTML = '<p class="text-slate-500 text-sm italic">Aún no tienes playlists. Crea una arriba.</p>';
        return;
    }

    querySnapshot.forEach((doc) => {
        const playlist = doc.data();
        const pin = doc.id;
        
        const div = document.createElement('div');
        div.className = "flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5 hover:border-primary/30 transition-all group";
        div.innerHTML = `
            <div>
                <h4 class="font-bold text-slate-100">${playlist.title}</h4>
                <p class="text-[10px] text-slate-500 uppercase tracking-widest">PIN compartidO: <span class="text-secondary font-mono text-xs font-bold">${pin}</span></p>
            </div>
            <div class="flex gap-2">
                <button class="play-this-btn px-4 py-2 bg-primary/20 hover:bg-primary text-xs font-bold rounded-lg transition-all" data-pin="${pin}" data-url="${playlist.url}" data-title="${playlist.title}">
                    Jugar
                </button>
                <button class="show-ranking-btn p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg transition-all" data-pin="${pin}" data-title="${playlist.title}" title="Ver Ranking">
                    🏆
                </button>
                <button class="delete-playlist-btn p-2 text-slate-500 hover:text-red-400 transition-colors" data-pin="${pin}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        `;
        myPlaylistsList.appendChild(div);
    });

    // Event listeners for generated buttons
    document.querySelectorAll('.play-this-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { pin, url, title } = e.target.dataset;
            currentPlaylist = { url, ownerName: "Mí", sharePin: pin, title };
            activePlaylistInfo.classList.remove('hidden');
            activePlaylistOwner.textContent = `Tu Lista (${title})`;
            showNotification(`Cargada playlist: ${title}`, "success");
        });
    });

    document.querySelectorAll('.delete-playlist-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const pin = e.currentTarget.dataset.pin;
            if (confirm("¿Seguro que quieres borrar esta playlist? El PIN y el ranking se perderán.")) {
                await deletePlaylist(pin);
            }
        });
    });

    document.querySelectorAll('.show-ranking-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { pin, title } = e.currentTarget.dataset;
            showRanking(pin, title);
        });
    });
}

createPlaylistBtn.addEventListener('click', async () => {
    const title = newPlaylistName.value.trim();
    const url = newPlaylistUrl.value.trim();
    
    if (!title || !url) {
        showNotification("Por favor, introduce un nombre y una URL.", "error");
        return;
    }

    try {
        const pin = await generateUniqueLetterPin();
        await setDoc(doc(db, "playlists", pin), {
            ownerUid: currentUser.uid,
            title: title,
            url: url,
            createdAt: new Date().toISOString()
        });
        
        newPlaylistName.value = "";
        newPlaylistUrl.value = "";
        await loadMyPlaylists();
        showNotification(`Playlist '${title}' creada con éxito.`, "success");
    } catch (error) {
        console.error("Error creating playlist:", error);
    }
});

async function deletePlaylist(pin) {
    try {
        // Note: Real deletion logic might need to clean up rankings too
        // For simplicity in Phase 1, we just remove the playlist doc
        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        await deleteDoc(doc(db, "playlists", pin));
        await loadMyPlaylists();
        
        if (currentPlaylist.sharePin === pin) {
            resetToMineBtn.click();
        }
    } catch (error) {
        console.error("Error deleting playlist:", error);
    }
}

loadFriendBtn.addEventListener('click', async () => {
    const pin = friendPinInput.value.trim().toUpperCase();
    if (!pin) return;
    
    try {
        const playlistSnap = await getDoc(doc(db, "playlists", pin));
        if (playlistSnap.exists()) {
            const playlistData = playlistSnap.data();
            const ownerSnap = await getDoc(doc(db, "users", playlistData.ownerUid));
            const ownerName = ownerSnap.exists() ? ownerSnap.data().displayName : "Amigo";
            
            currentPlaylist = {
                url: playlistData.url,
                ownerName: ownerName,
                sharePin: pin,
                title: playlistData.title
            };
            
            activePlaylistInfo.classList.remove('hidden');
            activePlaylistOwner.textContent = `${ownerName} (${playlistData.title})`;
            showNotification(`Jugando con la playlist de ${ownerName}: ${playlistData.title}`, "info");
        } else {
            showNotification("PIN de playlist no encontrado.", "error");
        }
    } catch (error) {
        console.error("Error loading friend playlist:", error);
    }
});

resetToMineBtn.addEventListener('click', () => {
    currentPlaylist = { url: "", ownerName: "Mí", sharePin: "", title: "" };
    activePlaylistInfo.classList.add('hidden');
    friendPinInput.value = "";
    showNotification("Has vuelto a tu propia playlist.", "info");
});

// --- Game Logic ---

async function startGame(mode) {
    if (!currentPlaylist.url) {
        showNotification("Primero selecciona una playlist para jugar.", "error");
        showSection('panel');
        return;
    }

    const playlistId = MusicAPI.extractPlaylistId(currentPlaylist.url);
    if (!playlistId) {
        showNotification("URL de playlist no válida. Prueba a copiar la URL de la barra del navegador.", "error");
        showSection('panel');
        return;
    }

    try {
        gameStatus.textContent = "Cargando música...";
        const tracks = await MusicAPI.fetchPlaylistTracks(playlistId);
        
        if (tracks.length === 0) {
            showNotification("No se pudieron cargar canciones de esta playlist.", "error");
            return;
        }

        gameState = {
            // Solo canciones que tengan URL de previsualización (preview)
            tracks: tracks.filter(t => t.preview && t.preview.length > 0)
                          .sort(() => Math.random() - 0.5)
                          .slice(0, 10), 
            currentIndex: 0,
            score: 0,
            mode: mode,
            timer: null,
            isPlaying: true
        };

        scoreDisplay.textContent = "0";
        gameModeLabel.textContent = `Modo: ${mode === 'title' ? 'Canción' : 'Artista'}`;
        loadRound();
    } catch (error) {
        console.error("Error starting game:", error);
        showNotification("Error al conectar con la API de música.", "error");
    }
}

function loadRound() {
    const track = gameState.tracks[gameState.currentIndex];
    roundIndicator.textContent = `Ronda ${gameState.currentIndex + 1}/10`;
    
    // Reset UI
    answerInput.value = "";
    answerInput.disabled = false;
    answerInput.focus();
    submitAnswerBtn.classList.remove('hidden');
    nextTrackBtn.classList.add('hidden');
    resultMessage.classList.add('hidden');
    feedbackIcon.classList.add('hidden');
    gameStatus.textContent = "¿Sabes qué música suena?";
    
    // Audio Setup & Error Handling
    audioPlayer.src = track.preview;
    audioPlayer.currentTime = 0;
    
    // Si hay un error de carga (ej: 404 o geo-bloqueo), saltamos la canción sin penalizar
    audioPlayer.onerror = () => {
        console.warn("Error al cargar el audio de:", track.title, ". Saltando...");
        showNotification("Canción sin audio disponible, saltando...", "info");
        if (gameState.currentIndex < gameState.tracks.length - 1) {
            gameState.currentIndex++;
            loadRound();
        } else {
            // Si es la última, acabamos
            showNotification(`¡Partida terminada! Puntuación final: ${gameState.score}`, "success");
            updateScoreInFirestore(gameState.score);
            showSection('panel');
        }
    };

    audioPlayer.play().catch(e => {
        console.error("Error al reproducir audio:", e);
    });
    
    let secondsLeft = 15;
    timeLeftDisplay.textContent = `${secondsLeft}s`;
    
    if (gameState.timer) clearInterval(gameState.timer);
    gameState.timer = setInterval(() => {
        secondsLeft--;
        timeLeftDisplay.textContent = `${secondsLeft}s`;
        
        if (secondsLeft <= 0) {
            clearInterval(gameState.timer);
            audioPlayer.pause();
            if (!answerInput.disabled) {
                checkAnswer(""); // Time out
            }
        }
    }, 1000);
}

function checkAnswer() {
    const userAnswer = answerInput.value.trim();
    const track = gameState.tracks[gameState.currentIndex];
    
    let correctAnswer = "";
    let userInputCleaned = userAnswer;

    if (gameState.mode === 'tracks') {
        correctAnswer = cleanSongTitle(track.title);
        userInputCleaned = cleanSongTitle(userAnswer);
    } else {
        correctAnswer = track.artist.name;
    }
    
    clearInterval(gameState.timer);
    audioPlayer.pause();
    answerInput.disabled = true;
    
    const isCorrect = fuzzyMatch(userInputCleaned, correctAnswer);
    
    if (isCorrect) {
        gameState.score += 10;
        scoreDisplay.textContent = gameState.score;
        showFeedback(true, correctAnswer);
    } else {
        showFeedback(false, correctAnswer);
    }

    submitAnswerBtn.classList.add('hidden');
    nextTrackBtn.classList.remove('hidden');
    
    if (gameState.currentIndex === gameState.tracks.length - 1) {
        nextTrackBtn.textContent = "Finalizar Partida";
    } else {
        nextTrackBtn.textContent = "Siguiente";
    }
}

function showFeedback(correct, answer) {
    resultMessage.classList.remove('hidden');
    feedbackIcon.classList.remove('hidden');
    
    if (correct) {
        resultMessage.className = "text-center p-4 rounded-xl bg-green-500/20 border border-green-500/30 animate-bounce-short";
        resultText.textContent = "¡Correcto! +10 puntos";
        resultText.className = "font-bold text-lg text-green-400";
        feedbackIcon.textContent = "✅";
    } else {
        resultMessage.className = "text-center p-4 rounded-xl bg-red-500/20 border border-red-500/30";
        resultText.textContent = "¡Ups! No es correcto";
        resultText.className = "font-bold text-lg text-red-400";
        feedbackIcon.textContent = "❌";
    }
    
    correctAnswerIs.textContent = `Era: ${answer}`;
}

// Algoritmo de Levenshtein para flexibilidad
function fuzzyMatch(input, target) {
    if (!input || !target) return false;
    
    const s1 = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const s2 = target.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    if (s1 === s2 || s2.includes(s1) || s1.includes(s2)) return true;
    
    const distance = levenshtein(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    // Permitir un 20% de error (mínimo 1 letra)
    const threshold = Math.max(1, Math.floor(maxLength * 0.25));
    return distance <= threshold;
}

function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// --- UI Event Listeners ---

function showSection(sectionId) {
    const sections = [loginSection, panelSection, gameSection, classModeSection, hostSection, playerSection];
    sections.forEach(s => s.classList.add('hidden'));
    
    const target = {
        'login': loginSection,
        'panel': panelSection,
        'game': gameSection,
        'class-mode': classModeSection,
        'host': hostSection,
        'player': playerSection
    }[sectionId];
    
    if (target) target.classList.remove('hidden');
    
    // Al mostrar el panel, cargar el nombre
    if (sectionId === 'panel' && auth.currentUser) {
        document.getElementById('user-display-name').textContent = auth.currentUser.displayName || "Usuario";
    }
}

document.getElementById('play-tracks-btn').addEventListener('click', () => {
    showSection('game');
    startGame('title');
});

document.getElementById('play-artists-btn').addEventListener('click', () => {
    showSection('game');
    startGame('artist');
});

submitAnswerBtn.addEventListener('click', checkAnswer);

answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !answerInput.disabled) {
        checkAnswer();
    }
});

nextTrackBtn.addEventListener('click', async () => {
    if (gameState.currentIndex < gameState.tracks.length - 1) {
        gameState.currentIndex++;
        loadRound();
    } else {
        // End Game
        showNotification(`¡Partida terminada! Puntuación final: ${gameState.score}`, "success");
        await updateScoreInFirestore(gameState.score);
        showSection('panel');
    }
});

async function updateScoreInFirestore(score) {
    const user = auth.currentUser;
    if (!user || !currentPlaylist.sharePin) return;

    try {
        const scoreRef = doc(db, "leaderboards", currentPlaylist.sharePin, "scores", user.uid);
        
        // Consultamos si ya existe una puntuación previa
        const docSnap = await getDoc(scoreRef);
        
        if (docSnap.exists()) {
            const previousScore = docSnap.data().score || 0;
            if (score <= previousScore) {
                console.log(`Puntuación actual (${score}) no supera el récord previo (${previousScore}). No se actualiza.`);
                showNotification(`¡Buen intento! Tu récord en esta lista es de ${previousScore} pts.`, "info");
                return;
            }
            showNotification(`¡NUEVO RÉCORD! Has superado tus ${previousScore} pts anteriores. 🏆`, "success");
        } else {
            showNotification("¡Primera puntuación registrada en este ranking! 🚀", "success");
        }

        await setDoc(scoreRef, {
            displayName: user.displayName || "Jugador",
            score: score,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error("Error updating score:", error);
    }
}

document.getElementById('back-to-panel').addEventListener('click', () => {
    clearInterval(gameState.timer);
    audioPlayer.pause();
    showSection('panel');
});

// --- UI Logic Helpers ---

async function showRanking(pin, title) {
    const modal = document.getElementById('ranking-modal');
    const titleDisplay = document.getElementById('ranking-playlist-title');
    const rankingList = document.getElementById('ranking-list');
    
    titleDisplay.textContent = title || `PIN: ${pin}`;
    rankingList.innerHTML = '<p class="text-center text-slate-500 py-20 animate-pulse">Consultando el salón de la fama...</p>';
    modal.classList.remove('hidden');

    try {
        const { orderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const scoresRef = collection(db, "leaderboards", pin, "scores");
        const q = query(scoresRef, orderBy("score", "desc"), limit(10));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            rankingList.innerHTML = '<p class="text-center text-slate-500 py-20 italic">Aún no hay puntuaciones en esta lista. ¡Sé el primero!</p>';
            return;
        }

        rankingList.innerHTML = "";
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('div');
            row.className = `leaderboard-row flex items-center justify-between p-3 rounded-xl border border-white/5 ${rank <= 3 ? 'bg-white/5' : ''}`;
            
            const badgeClass = rank <= 3 ? `rank-badge rank-badge-${rank}` : 'rank-badge text-slate-500';
            const nameClass = rank <= 3 ? `rank-${rank} font-bold` : 'text-slate-300';

            row.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="${badgeClass}">${rank}</div>
                    <div class="${nameClass}">${data.displayName || 'Anónimo'}</div>
                </div>
                <div class="font-mono font-bold text-slate-100">${data.score} pts</div>
            `;
            rankingList.appendChild(row);
            rank++;
        });
    } catch (error) {
        console.error("Error fetching ranking:", error);
        rankingList.innerHTML = '<p class="text-center text-red-400 py-20">Error al cargar puntuaciones.</p>';
    }
}

// Global Modal Listeners
document.getElementById('close-ranking-btn').addEventListener('click', () => {
    document.getElementById('ranking-modal').classList.add('hidden');
});

document.getElementById('ranking-modal').addEventListener('click', (e) => {
    if (e.target.id === 'ranking-modal') {
        document.getElementById('ranking-modal').classList.add('hidden');
    }
});

document.getElementById('active-playlist-ranking-btn').addEventListener('click', () => {
    if (currentPlaylist.sharePin) {
        showRanking(currentPlaylist.sharePin, currentPlaylist.title);
    }
});

// --- Multiplayer Logic (Class Mode) ---

let currentRoom = {
    id: null,
    pin: null,
    role: null, // 'host' or 'player'
    unsubscribe: null
};

classModeEntryBtn.addEventListener('click', () => {
    showSection('class-mode');
});

backFromClassBtn.addEventListener('click', () => {
    showSection('panel');
});

createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);

async function createRoom() {
    if (!currentPlaylist.url) {
        showNotification("Selecciona primero una playlist para tu sesión Live.", "error");
        showSection('panel');
        return;
    }

    const roomPin = Math.floor(1000 + Math.random() * 9000).toString();
    const playlistId = MusicAPI.extractPlaylistId(currentPlaylist.url);

    try {
        const roomRef = await addDoc(collection(db, "rooms"), {
            pin: roomPin,
            hostUid: auth.currentUser.uid,
            playlistId: playlistId,
            playlistTitle: currentPlaylist.title,
            status: 'waiting',
            currentIndex: 0,
            players: [],
            createdAt: new Date()
        });

        currentRoom = {
            id: roomRef.id,
            pin: roomPin,
            role: 'host'
        };

        hostPinDisplay.textContent = roomPin;
        showSection('host');
        listenToPlayers(roomRef.id);
        
        // Cargar canciones inicialmente para el host
        const tracks = await MusicAPI.fetchPlaylistTracks(playlistId);
        gameState.tracks = tracks.filter(t => t.preview).sort(() => Math.random() - 0.5).slice(0, 10);
        
        startClassGameBtn.classList.remove('hidden');
        startClassGameBtn.addEventListener('click', startClassGame);
        hostNextRoundBtn.addEventListener('click', nextClassRound);
    } catch (e) {
        console.error(e);
        showNotification("Error al crear la sala.", "error");
    }
}

async function joinRoom() {
    const pin = joinRoomPinInput.value.trim();
    if (pin.length !== 4) return;

    try {
        const q = query(collection(db, "rooms"), where("pin", "==", pin), where("status", "==", "waiting"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showNotification("Sala no encontrada o ya ha empezado.", "error");
            return;
        }

        const roomDoc = snapshot.docs[0];
        const roomId = roomDoc.id;

        // Añadir jugador a la sala
        const participantRef = doc(db, "rooms", roomId, "participants", auth.currentUser.uid);
        await setDoc(participantRef, {
            name: auth.currentUser.displayName || "Alumno",
            score: 0,
            joinedAt: new Date()
        });

        currentRoom = {
            id: roomId,
            pin: pin,
            role: 'player'
        };

        showSection('player');
        listenToRoom(roomId);
    } catch (e) {
        console.error(e);
        showNotification("Error al unirse a la sala.", "error");
    }
}

function listenToPlayers(roomId) {
    onSnapshot(collection(db, "rooms", roomId, "participants"), (snapshot) => {
        hostPlayerList.innerHTML = "";
        playerCountBadge.textContent = snapshot.size;
        
        // Ordenar por puntuación para el ranking en vivo
        const players = [];
        snapshot.forEach(doc => players.push({id: doc.id, ...doc.data()}));
        players.sort((a, b) => b.score - a.score);

        players.forEach(p => {
            const tag = document.createElement('div');
            tag.className = "player-tag bg-white/10 px-6 py-3 rounded-2xl flex flex-col items-center min-w-[120px] border border-white/5 shadow-xl";
            tag.innerHTML = `
                <span class="text-xs text-slate-400 font-bold uppercase tracking-widest">${p.name}</span>
                <span class="text-2xl font-black text-secondary">${p.score}</span>
            `;
            hostPlayerList.appendChild(tag);
        });
    });
}

function listenToRoom(roomId) {
    currentRoom.unsubscribe = onSnapshot(doc(db, "rooms", roomId), (doc) => {
        const data = doc.data();
        if (!data) return;

        if (data.status === 'playing') {
            setupPlayerRound(data.currentIndex, data.roundStartTime);
        } else if (data.status === 'checking') {
            processRoundResults(data.lastCorrectAnswer);
        } else if (data.status === 'finished') {
            showNotification("Sesión Live terminada. ¡Gracias por participar!", "info");
            showSection('panel');
        }
    });
}

let playerCurrentRoundState = {
    answered: false,
    answerTime: null,
    startTime: null
};

function setupPlayerRound(index, startTime) {
    playerWaiting.classList.add('hidden');
    playerFeedback.classList.add('hidden');
    playerGame.classList.remove('hidden');
    playerAnswerInput.value = "";
    playerAnswerInput.disabled = false;
    playerSubmitBtn.disabled = false;
    playerAnswerInput.focus();
    
    playerCurrentRoundState = {
        answered: false,
        startTime: startTime ? startTime.toDate() : new Date(),
        answerTime: null
    };
}

async function processRoundResults(correctAnswer) {
    playerGame.classList.add('hidden');
    
    let points = 0;
    if (playerCurrentRoundState.answered) {
        // Usamos la misma lógica de comparación que en el modo individual
        const cleanUserAnswer = cleanTitle(playerCurrentRoundState.userAnswer).toLowerCase();
        const cleanCorrectAnswer = cleanTitle(correctAnswer).toLowerCase();
        
        if (cleanUserAnswer === cleanCorrectAnswer || cleanCorrectAnswer.includes(cleanUserAnswer) && cleanUserAnswer.length > 3) {
            // Cálculo de puntos: 500 Base + hasta 500 por velocidad (15 segundos max)
            const timeTaken = playerCurrentRoundState.answerTime - playerCurrentRoundState.startTime;
            const speedBonus = Math.max(0, Math.floor((15000 - timeTaken) / 15000 * 500));
            points = 500 + speedBonus;
            
            // Actualizar puntos en el servidor para el host
            const participantRef = doc(db, "rooms", currentRoom.id, "participants", auth.currentUser.uid);
            await updateDoc(participantRef, {
                score: increment(points)
            });
        }
    }
    
    showPlayerFeedback(correctAnswer, points);
}

function showPlayerFeedback(correctAnswer, points = 0) {
    playerGame.classList.add('hidden');
    playerFeedback.classList.remove('hidden');
    
    if (points > 0) {
        playerFeedbackIcon.textContent = "✅";
        playerFeedbackText.textContent = "¡CORRECTO!";
        playerPointsEarned.textContent = `+${points} pts`;
        playerPointsEarned.classList.replace('text-red-400', 'text-secondary');
    } else {
        playerFeedbackIcon.textContent = "🙊";
        playerFeedbackText.textContent = "¡VAYA...!";
        playerPointsEarned.textContent = `La respuesta era: ${correctAnswer}`;
        playerPointsEarned.classList.replace('text-secondary', 'text-red-400');
    }
}

async function startClassGame() {
    startClassGameBtn.classList.add('hidden');
    hostGameControls.classList.remove('hidden');
    await updateDoc(doc(db, "rooms", currentRoom.id), {
        status: 'playing',
        currentIndex: 0,
        roundStartTime: new Date()
    });
    runHostTimer();
}

async function nextClassRound() {
    if (gameState.currentIndex < gameState.tracks.length - 1) {
        gameState.currentIndex++;
        hostNextRoundBtn.classList.add('hidden');
        await updateDoc(doc(db, "rooms", currentRoom.id), {
            status: 'playing',
            currentIndex: gameState.currentIndex,
            roundStartTime: new Date()
        });
        runHostTimer();
    } else {
        await updateDoc(doc(db, "rooms", currentRoom.id), { status: 'finished' });
        showNotification("¡Fin del juego multijugador!", "success");
        showSection('panel');
    }
}

function runHostTimer() {
    const track = gameState.tracks[gameState.currentIndex];
    audioPlayer.src = track.preview;
    audioPlayer.play();

    let seconds = 15;
    const hostTimerDisplay = document.getElementById('host-timer');
    hostTimerDisplay.textContent = seconds;
    
    const interval = setInterval(async () => {
        seconds--;
        hostTimerDisplay.textContent = seconds;
        
        if (seconds <= 0) {
            clearInterval(interval);
            audioPlayer.pause();
            // Fin de ronda para todos
            await updateDoc(doc(db, "rooms", currentRoom.id), {
                status: 'checking',
                lastCorrectAnswer: cleanTitle(track.title)
            });
            hostNextRoundBtn.classList.remove('hidden');
        }
    }, 1000);
}

// Auxiliar para limpiar títulos (copia de la anterior para consistencia)
const cleanTitle = (str) => str.replace(/\s*\([^)]*\)*/g, '').trim();

playerSubmitBtn.addEventListener('click', submitPlayerAnswer);
playerAnswerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitPlayerAnswer();
});

async function submitPlayerAnswer() {
    const answer = playerAnswerInput.value.trim();
    if (!answer || playerCurrentRoundState.answered) return;

    playerCurrentRoundState.answered = true;
    playerCurrentRoundState.answerTime = new Date();
    playerCurrentRoundState.userAnswer = answer;

    playerAnswerInput.disabled = true;
    playerSubmitBtn.disabled = true;

    try {
        showNotification("¡Respuesta enviada! Cruzando dedos...", "info");
        // No enviamos la puntuación todavía, esperamos a que el Host revele la respuesta 
        // para evitar que alguien use la API de Firebase para ver el título antes de tiempo.
    } catch (e) {
        console.error(e);
    }
}

// --- Profile & Settings Logic ---

openSettingsBtn.addEventListener('click', () => {
    settingsNameInput.value = auth.currentUser.displayName || "";
    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

themeDots.forEach(dot => {
    dot.addEventListener('click', () => {
        themeDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        applyTheme(dot.dataset.theme);
    });
});

customColorInput.addEventListener('input', (e) => {
    applyTheme('custom', e.target.value);
});

async function applyTheme(themeName, customColor = null) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('user-theme', themeName);

    if (themeName === 'custom' && customColor) {
        document.documentElement.style.setProperty('--primary', customColor);
        document.documentElement.style.setProperty('--border', `${customColor}22`);
        localStorage.setItem('custom-theme-color', customColor);
    } else {
        // Limpiar propiedades personalizadas si no es custom
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--border');
    }
}

saveSettingsBtn.addEventListener('click', async () => {
    const newName = settingsNameInput.value.trim();
    if (!newName) return;

    try {
        await updateProfile(auth.currentUser, { displayName: newName });
        document.getElementById('user-display-name').textContent = newName;
        
        // Guardar theme en firestore si queremos persistencia entre dispositivos
        await setDoc(doc(db, "users", auth.currentUser.uid), {
            theme: document.body.getAttribute('data-theme'),
            customColor: localStorage.getItem('custom-theme-color') || null
        }, { merge: true });

        showNotification("Perfil actualizado correctamente.", "success");
        settingsModal.classList.add('hidden');
    } catch (e) {
        console.error(e);
        showNotification("Error al guardar ajustes.", "error");
    }
});

// Cargar tema al iniciar
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('user-theme') || 'midnight';
    const savedColor = localStorage.getItem('custom-theme-color');
    applyTheme(savedTheme, savedColor);
});

function showNotification(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Emojis based on type
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span>${icons[type] || '🔔'}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
