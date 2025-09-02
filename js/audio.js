// audio.js
// Manejo de audio y sonidos

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.completionSounds = [
            'sounds/completion.mp3',
            'sounds/completion.wav'
        ];
    }

    // Reproducir sonido de completado
    playCompletionSound() {
        try {
            const audio = new Audio();
            audio.src = chrome.runtime.getURL(this.completionSounds[0]);
            audio.volume = 0.5; // Volumen moderado
            
            audio.play().catch(err => {
                console.log('No se pudo reproducir el sonido de completado:', err);
                // Intentar con formato alternativo
                this.tryAlternativeSound();
            });
        } catch (error) {
            console.log('Error al cargar sonido de completado:', error);
        }
    }

    // Intentar con formato alternativo
    tryAlternativeSound() {
        try {
            const audio = new Audio();
            audio.src = chrome.runtime.getURL(this.completionSounds[1]);
            audio.volume = 0.5;
            
            audio.play().catch(err2 => {
                console.log('No se pudo reproducir sonido alternativo:', err2);
            });
        } catch (error) {
            console.log('Error al cargar sonido alternativo:', error);
        }
    }

    // Reproducir sonido personalizado
    playCustomSound(soundPath, volume = 0.5) {
        try {
            const audio = new Audio();
            audio.src = chrome.runtime.getURL(soundPath);
            audio.volume = volume;
            
            return audio.play().catch(err => {
                console.log(`No se pudo reproducir sonido ${soundPath}:`, err);
                throw err;
            });
        } catch (error) {
            console.log(`Error al cargar sonido ${soundPath}:`, error);
            throw error;
        }
    }
}

// Instancia global del manager de audio
window.audioManager = new AudioManager();
