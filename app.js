// app.js - Phase 2: Game Logic & Music Integration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { MusicAPI } from "./api.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut,
    updateProfile
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
        userNameDisplay.textContent = userData.displayName || user.displayName;
        
        const avatarUrl = userData.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.uid}`;
        const mainAvatar = document.getElementById('main-user-avatar');
        if (mainAvatar) mainAvatar.src = avatarUrl;
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

async function loadPlayedHistory() {
    const user = auth.currentUser;
    if (!user) return;

    const otherPlaylistsList = document.getElementById('other-playlists-list');
    if (!otherPlaylistsList) return;

    try {
        const { collection, getDocs, orderBy, query, limit } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const historyRef = collection(db, "users", user.uid, "played_history");
        const q = query(historyRef, orderBy("lastPlayed", "desc"), limit(10));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            otherPlaylistsList.innerHTML = '<p class="text-slate-500 text-[10px] italic">Aún no has jugado listas de otros.</p>';
            return;
        }

        otherPlaylistsList.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const pin = doc.id;
            
            const div = document.createElement('div');
            div.className = "flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 hover:border-secondary/30 transition-all group";
            div.innerHTML = `
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-100 text-xs truncate">${data.title}</h4>
                    <p class="text-[8px] text-slate-500 uppercase">PIN: <span class="text-secondary font-mono font-bold">${pin}</span> • De: ${data.ownerName}</p>
                </div>
                <div class="flex gap-2">
                    <button class="play-this-btn p-2 bg-secondary/10 hover:bg-secondary text-[10px] font-bold rounded-lg transition-all" data-pin="${pin}" data-url="${data.url}" data-title="${data.title}">
                        ▶
                    </button>
                    <button class="show-ranking-btn p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg transition-all" data-pin="${pin}" data-title="${data.title}">
                        🏆
                    </button>
                </div>
            `;
            otherPlaylistsList.appendChild(div);
        });

        // Event listeners para el historial
        otherPlaylistsList.querySelectorAll('.play-this-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const el = e.currentTarget;
                const { pin, url, title } = el.dataset;
                currentPlaylist = { url, ownerName: "Mundo", sharePin: pin, title };
                activePlaylistInfo.classList.remove('hidden');
                activePlaylistOwner.textContent = `Reto de Amigo (${title})`;
            });
        });

        otherPlaylistsList.querySelectorAll('.show-ranking-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { pin, title } = e.currentTarget.dataset;
                showRanking(pin, title);
            });
        });

    } catch (error) {
        console.error("Error loading history:", error);
    }
}

async function loadMyPlaylists() {
    const q = query(collection(db, "playlists"), where("ownerUid", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    myPlaylistsList.innerHTML = "";
    
    if (querySnapshot.empty) {
        myPlaylistsList.innerHTML = '<p class="text-slate-500 text-sm italic">Aún no tienes playlists. Crea una arriba.</p>';
        loadPlayedHistory();
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
                <button class="share-playlist-btn p-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg transition-all" data-pin="${pin}" data-title="${playlist.title}" title="Compartir por WhatsApp">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.067 2.877 1.215 3.076.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.632 1.432h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
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

    loadPlayedHistory();

    // Event listeners para mis listas
    document.querySelectorAll('#my-playlists-list .play-this-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { pin, url, title } = e.target.dataset;
            currentPlaylist = { url, ownerName: "Mí", sharePin: pin, title };
            activePlaylistInfo.classList.remove('hidden');
            activePlaylistOwner.textContent = `Tu Lista (${title})`;
            showNotification(`Cargada playlist: ${title}`, "success");
        });
    });

    document.querySelectorAll('#my-playlists-list .share-playlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { pin, title } = e.currentTarget.dataset;
            sharePlaylist(pin, title);
        });
    });

    document.querySelectorAll('#my-playlists-list .delete-playlist-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const pin = e.currentTarget.dataset.pin;
            await deletePlaylist(pin);
        });
    });

    document.querySelectorAll('#my-playlists-list .show-ranking-btn').forEach(btn => {
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

    if (gameState.mode === 'title') {
        correctAnswer = cleanSongTitle(track.title);
        userInputCleaned = cleanSongTitle(userAnswer);
    } else {
        correctAnswer = track.artist;
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
    
    if (s1 === s2 || (s1.length > 3 && (s2.includes(s1) || s1.includes(s2)))) return true;
    
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

        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const avatarUrl = userData.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.uid}`;

        await setDoc(scoreRef, {
            displayName: user.displayName || "Jugador",
            score: score,
            avatarUrl: avatarUrl,
            timestamp: new Date()
        });

        // Registrar en el historial del usuario que ha jugado a esta lista
        // (Solo si no es suya, para no duplicar)
        if (currentPlaylist.ownerUid !== user.uid) {
            const historyRef = doc(db, "users", user.uid, "played_history", currentPlaylist.sharePin);
            await setDoc(historyRef, {
                title: currentPlaylist.title,
                ownerName: currentPlaylist.ownerName,
                url: currentPlaylist.url,
                lastPlayed: new Date()
            }, { merge: true });
        }
        
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
            const scoreData = doc.data();
            const isMe = auth.currentUser && scoreData.displayName === auth.currentUser.displayName;
            const avatarUrl = scoreData.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${scoreData.displayName}`;
            
            const row = document.createElement('div');
            row.className = `leaderboard-row flex items-center justify-between p-3 rounded-xl border border-white/5 ${rank <= 3 ? 'bg-white/5' : ''}`;
            
            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                        ${rank}
                    </div>
                    <img src="${avatarUrl}" class="w-8 h-8 rounded-full bg-white/10 p-0.5 border border-white/10" alt="Avatar">
                    <span class="font-bold text-sm ${isMe ? 'text-primary' : ''}">${scoreData.displayName || 'Anónimo'}</span>
                </div>
                <div class="text-right">
                    <div class="font-black text-secondary">${scoreData.score.toLocaleString()} pts</div>
                    <div class="text-[8px] text-slate-500 uppercase">${scoreData.timestamp ? new Date(scoreData.timestamp.toDate()).toLocaleDateString() : ''}</div>
                </div>
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
        const userInputCleaned = cleanSongTitle(playerCurrentRoundState.userAnswer);
        const isCorrect = fuzzyMatch(userInputCleaned, correctAnswer);
        
        if (isCorrect) {
            // Cálculo de puntos: 100 Base + hasta 100 por velocidad (15 segundos max)
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
                lastCorrectAnswer: cleanSongTitle(track.title)
            });
            hostNextRoundBtn.classList.remove('hidden');
        }
    }, 1000);
}


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
    } catch (e) {
        console.error(e);
    }
}

// --- Profile & Settings Logic ---

const AVATAR_OPTIONS = {
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

const avatarPreview = document.getElementById('avatar-preview');

const avatarSelects = {
    top: document.getElementById('avatar-top'),
    hairColor: document.getElementById('avatar-hairColor'),
    accessories: document.getElementById('avatar-accessories'),
    accessoriesColor: document.getElementById('avatar-accessoriesColor'),
    facialHair: document.getElementById('avatar-facialHair'),
    facialHairColor: document.getElementById('avatar-facialHairColor'),
    clothing: document.getElementById('avatar-clothing'),
    clothesColor: document.getElementById('avatar-clothingColor'),
    skinColor: document.getElementById('avatar-skinColor'),
    eyes: document.getElementById('avatar-eyes'),
    eyebrows: document.getElementById('avatar-eyebrows'),
    mouth: document.getElementById('avatar-mouth')
};

function initAvatarSelects() {
    Object.keys(AVATAR_OPTIONS).forEach(key => {
        const select = avatarSelects[key];
        if (!select) return;
        
        select.innerHTML = AVATAR_OPTIONS[key].map(opt => 
            `<option value="${opt.v}">${opt.l}</option>`
        ).join('');
        
        select.addEventListener('change', updateAvatarPreview);
    });
}

function updateAvatarPreview() {
    const user = auth.currentUser;
    if (!user) return;

    const params = new URLSearchParams({
        seed: user.uid
    });
    
    // Forzar 100% de probabilidad por defecto para tipos específicos si se seleccionan
    // O 0% si se elige "none"
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

openSettingsBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    // Reset tabs to profile by default on open
    const profileTabBtn = document.querySelector('.settings-tab-btn[data-tab="profile"]');
    if (profileTabBtn) profileTabBtn.click();
    
    settingsNameInput.value = user.displayName || "";
    
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.avatarConfig) {
            Object.keys(data.avatarConfig).forEach(key => {
                if (avatarSelects[key]) avatarSelects[key].value = data.avatarConfig[key];
            });
        }
    }
    
    updateAvatarPreview();
    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

saveSettingsBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const newName = settingsNameInput.value.trim();
    const avatarConfig = {};
    Object.keys(avatarSelects).forEach(key => {
        avatarConfig[key] = avatarSelects[key].value;
    });
    
    const avatarUrl = updateAvatarPreview();

    try {
        await updateProfile(user, { displayName: newName });
        console.log("Guardando en Firestore:", { displayName: newName, avatarConfig, avatarUrl });
        await setDoc(doc(db, "users", user.uid), {
            displayName: newName,
            avatarConfig: avatarConfig,
            avatarUrl: avatarUrl
        }, { merge: true });
        console.log("Guardado completado con éxito");
        
        showNotification("Perfil actualizado correctamente", "success");
        settingsModal.classList.add('hidden');
        document.getElementById('user-display-name').textContent = newName;
        
        const mainAvatar = document.getElementById('main-user-avatar');
        if (mainAvatar) mainAvatar.src = avatarUrl;
        
    } catch (error) {
        console.error("Error saving profile:", error);
        showNotification("Error al guardar el perfil", "error");
    }
});

initAvatarSelects();

// --- Lógica de Pestañas del Modal de Ajustes ---
const tabBtns = document.querySelectorAll('.settings-tab-btn');
const tabContents = document.querySelectorAll('.settings-tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Reset buttons
        tabBtns.forEach(b => {
            b.classList.remove('active', 'bg-primary', 'text-white');
            b.classList.add('text-slate-500', 'hover:text-white');
        });
        
        // Active button
        btn.classList.add('active', 'bg-primary', 'text-white');
        btn.classList.remove('text-slate-500', 'hover:text-white');
        
        // Tab content
        tabContents.forEach(content => content.classList.add('hidden'));
        const targetContent = document.getElementById(`tab-${targetTab}`);
        if (targetContent) targetContent.classList.remove('hidden');
    });
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
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--border');
    }
}

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

// --- Funicones de Compartido (WhatsApp & Deep Linking) ---

async function deletePlaylist(pin) {
    if (!confirm("¿Seguro que quieres eliminar esta playlist de tu lista?")) return;

    try {
        const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        await deleteDoc(doc(db, "playlists", pin));
        showNotification("Playlist eliminada", "success");
        loadMyPlaylists();
    } catch (error) {
        console.error("Error deleting playlist:", error);
        showNotification("No tienes permiso para borrar esta lista", "error");
    }
}

function sharePlaylist(pin, title) {
    const url = `${window.location.origin}${window.location.pathname}?join=${pin}`;
    const text = `🎵 ¡Te reto en Reto Musical! \n\nLista: ${title}\nDale al link para jugar directamente: ${url}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
}

// Deep Linking: Auto-join por URL
function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const joinPin = params.get('join');
    if (joinPin) {
        // Limpiamos la URL para que no se quede el parámetro estorbando
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Esperamos a que el usuario esté autenticado para añadir
        onAuthStateChanged(getAuth(), (user) => {
            if (user) {
                setTimeout(() => {
                    addPlaylistByPin(joinPin);
                }, 1000);
            } else {
                showNotification("Inicia sesión para añadir la lista compartida", "info");
            }
        }, { once: true });
    }
}

async function addPlaylistByPin(pin) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const { getDoc, updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const pinDoc = await getDoc(doc(db, "playlists", pin));
        
        if (!pinDoc.exists()) {
            showNotification("Ese código de playlist ya no existe", "error");
            return;
        }

        const playlistData = pinDoc.data();
        
        // En este MVP, para que aparezca en "Mis Playlists", clonamos/actualizamos el dueño
        // O podríamos añadirlo a una lista de 'colaboradores'. 
        // Para simplificar y que el usuario vea la lista rápido:
        await updateDoc(doc(db, "playlists", pin), {
            ownerUid: user.uid,
            ownerName: user.displayName || "Usuario"
        });

        showNotification(`¡Lista "${playlistData.title}" añadida!`, "success");
        loadMyPlaylists();
    } catch (error) {
        console.error("Error adding by pin:", error);
        showNotification("No se pudo añadir la lista", "error");
    }
}

// Iniciar chequeo al cargar
checkDeepLink();
