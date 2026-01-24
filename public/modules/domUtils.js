// DOM utility functions
// Exports: getOrCreateLyricsContainer, getOrCreateLyricsControls

export function getOrCreateLyricsContainer() {
    let container = document.getElementById('lyricsContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'lyricsContainer';
        container.className = 'lyrics-container';
        // Insert into the main content area instead of body
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
    } else {
        container.className = 'lyrics-container';
    }
    return container;
}

export function getOrCreateLyricsControls() {
    let controls = document.getElementById('lyricsControls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'lyricsControls';
        controls.className = 'lyrics-controls';
        // Play/Pause button
        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'lyrics-btn';
        playPauseBtn.id = 'lyricsPlayPauseBtn';
        playPauseBtn.innerHTML = '▶️';
        controls.appendChild(playPauseBtn);
        // Insert controls in the main content area
        const mainContent = document.querySelector('.main-content');
        const container = document.getElementById('lyricsContainer');
        if (container && container.parentNode) {
            container.parentNode.insertBefore(controls, container);
        } else if (mainContent) {
            mainContent.appendChild(controls);
        } else {
            document.body.appendChild(controls);
        }
    }
    return controls;
}
