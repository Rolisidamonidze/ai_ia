// Audio utility functions
// Exports: getAudioDuration

export async function getAudioDuration(blob) {
    return new Promise(resolve => {
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(blob);
        audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    });
}
