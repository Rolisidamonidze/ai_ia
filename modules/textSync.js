// Text-audio synchronization module
// Exports: syncTextWithAudio, getWordTimings

/**
 * Synchronize text display with audio playback using word-level timings.
 * @param {string} text - The transcript text.
 * @param {Blob} audioBlob - The audio blob.
 * @param {Array} wordTimings - Array of {word, start, end} objects.
 * @param {HTMLElement} container - The DOM element to display the text.
 * @param {HTMLElement} [controls] - The controls container (optional, for play/pause)
 */
export function syncTextWithAudio(text, audioBlob, wordTimings, container, controls) {
    const audio = new Audio();
    audio.src = URL.createObjectURL(audioBlob);
    let currentWordIdx = -1;
    container.innerHTML = '';
    
    // Create a text wrapper for proper inline display
    const textWrapper = document.createElement('div');
    textWrapper.className = 'lyrics-text';
    
    // Create spans for each word
    wordTimings.forEach(({word}, i) => {
        const span = document.createElement('span');
        span.textContent = word + ' ';
        span.id = 'word-' + i;
        span.className = 'lyrics-word';
        textWrapper.appendChild(span);
    });
    
    container.appendChild(textWrapper);
    const spans = Array.from(textWrapper.children);
    function update() {
        const t = audio.currentTime;
        let idx = wordTimings.findIndex(({start, end}) => t >= start && t < end);
        if (idx !== currentWordIdx && idx !== -1) {
            if (currentWordIdx !== -1) spans[currentWordIdx].classList.remove('active');
            spans[idx].classList.add('active');
            currentWordIdx = idx;
        }
        if (!audio.paused && idx !== -1) requestAnimationFrame(update);
    }
    audio.onplay = () => {
        if (controls) updatePlayPauseBtn(controls, true);
        requestAnimationFrame(update);
    };
    audio.onpause = () => {
        if (controls) updatePlayPauseBtn(controls, false);
    };
    audio.onended = () => {
        spans.forEach(s => s.classList.remove('active'));
        if (controls) updatePlayPauseBtn(controls, false);
    };
    if (controls) {
        const btn = controls.querySelector('.lyrics-btn');
        if (btn) {
            btn.onclick = () => {
                if (audio.paused) audio.play();
                else audio.pause();
            };
            updatePlayPauseBtn(controls, false);
        }
    }
    audio.play();
}

function updatePlayPauseBtn(controls, isPlaying) {
    const btn = controls.querySelector('.lyrics-btn');
    if (btn) btn.innerHTML = isPlaying ? '⏸️' : '▶️';
}

/**
 * Dummy word timing generator (replace with forced alignment for real use)
 * Splits audio duration equally among words.
 */
export async function getWordTimings(text, audioBlob) {
    const words = text.split(/\s+/);
    const duration = await new Promise(res => {
        const a = document.createElement('audio');
        a.src = URL.createObjectURL(audioBlob);
        a.onloadedmetadata = () => res(a.duration);
    });
    const perWord = duration / words.length;
    return words.map((word, i) => ({
        word,
        start: i * perWord,
        end: (i + 1) * perWord
    }));
}
