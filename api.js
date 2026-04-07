// api.js - Music API Integration (Deezer)

export const MusicAPI = {
    /**
     * Extrae el ID de la playlist de una URL de Deezer
     */
    extractPlaylistId(url) {
        // Formatos soportados:
        // https://www.deezer.com/es/playlist/12345678
        // https://deezer.page.link/abcde (limitado si no se resuelve)
        const match = url.match(/playlist\/([0-9]+)/) || url.match(/\/([0-9]{5,15})(\?|$)/);
        return match ? match[1] : null;
    },

    /**
     * Obtiene los tracks de una playlist usando JSONP para evitar CORS
     */
    async fetchPlaylistTracks(playlistId) {
        if (!playlistId) return [];

        const url = `https://api.deezer.com/playlist/${playlistId}&output=jsonp`;
        
        try {
            const data = await this.jsonp(url);
            if (!data || !data.tracks) {
                console.error("No se encontraron tracks o error en la respuesta:", data);
                return [];
            }

            return data.tracks.data.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist.name,
                preview: track.preview,
                cover: track.album.cover_medium
            }));
        } catch (error) {
            console.error("Error fetching Deezer tracks:", error);
            throw error;
        }
    },

    /**
     * Helper para peticiones JSONP
     */
    jsonp(url) {
        return new Promise((resolve, reject) => {
            const callbackName = 'deezer_callback_' + Math.floor(Math.random() * 1000000);
            
            window[callbackName] = (data) => {
                delete window[callbackName];
                const scriptElement = document.getElementById(callbackName);
                if (scriptElement) scriptElement.remove();
                resolve(data);
            };

            const script = document.createElement('script');
            script.src = `${url}${url.indexOf('?') >= 0 ? '&' : '?'}callback=${callbackName}`;
            script.id = callbackName;
            script.onerror = () => {
                delete window[callbackName];
                reject(new Error("Error al cargar el script de Deezer (JSONP)"));
            };
            document.body.appendChild(script);
        });
    }
};
