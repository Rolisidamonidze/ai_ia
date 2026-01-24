// Text-audio synchronization module
// Exports: syncTextWithAudio, getWordTimings

// Global reference to currently playing audio
let currentAudio = null;

/**
 * Synchronize text display with audio playback using line-level timings.
 * @param {string} text - The transcript text.
 * @param {Blob} audioBlob - The audio blob.
 * @param {Array} wordTimings - Array of {word, start, end} objects (used to calculate line timings).
 * @param {HTMLElement} container - The DOM element to display the text.
 * @param {HTMLElement} [controls] - The controls container (optional, for play/pause)
 * @param {Function} [onEnded] - Callback function when audio ends
 */
export function syncTextWithAudio(text, audioBlob, wordTimings, container, controls, onEnded) {
    // Pause any currently playing audio
    if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    
    const audio = new Audio();
    audio.src = URL.createObjectURL(audioBlob);
    currentAudio = audio;  // Set as the currently active audio
    
    // Enable pitch preservation to avoid chipmunk/deep voice effects
    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.webkitPreservesPitch = true;
    
    let currentLineIdx = -1;
    container.innerHTML = '';
    
    // Create a text wrapper for proper inline display
    const textWrapper = document.createElement('div');
    textWrapper.className = 'lyrics-text';
    
    // Split text into lines and calculate line timings
    const lines = text.split('\n');
    const lineTimings = [];
    
    let wordIndex = 0;
    lines.forEach((line, lineIdx) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'lyrics-line';
        lineDiv.textContent = line;
        
        const words = line.trim().split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;
        
        // Calculate line timing based on the words in this line
        if (wordCount > 0 && wordIndex < wordTimings.length) {
            const startWord = wordIndex;
            const endWord = Math.min(wordIndex + wordCount - 1, wordTimings.length - 1);
            lineTimings.push({
                start: wordTimings[startWord].start,
                end: wordTimings[endWord].end
            });
            wordIndex += wordCount;
        } else {
            // Empty line or no timing data
            lineTimings.push({ start: -1, end: -1 });
        }
        
        textWrapper.appendChild(lineDiv);
    });
    
    container.appendChild(textWrapper);
    const lineElements = Array.from(textWrapper.querySelectorAll('.lyrics-line'));
    function update() {
        const t = audio.currentTime;
        let idx = lineTimings.findIndex(({start, end}) => t >= start && t < end);
        if (idx !== currentLineIdx && idx !== -1) {
            if (currentLineIdx !== -1) lineElements[currentLineIdx].classList.remove('active');
            lineElements[idx].classList.add('active');
            currentLineIdx = idx;
            
            // Auto-scroll to active line
            lineElements[idx].scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
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
        lineElements.forEach(l => l.classList.remove('active'));
        if (controls) updatePlayPauseBtn(controls, false);
        if (onEnded) onEnded();
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
