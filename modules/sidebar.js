// Sidebar rendering and logic
import { getOrCreateLyricsContainer, getOrCreateLyricsControls } from './domUtils.js';
import { getWordTimings, syncTextWithAudio } from './textSync.js';

export function getOrCreateSidebar() {
    let sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'sidebar';
        sidebar.className = 'sidebar';
        document.body.insertBefore(sidebar, document.body.firstChild);
    }
    return sidebar;
}

export async function renderSidebar({ apiForm, status, backBtn, downloadLink }) {
    const sidebar = getOrCreateSidebar();
    sidebar.innerHTML = '<h2>Saved Items</h2>';
    
    try {
        // Load items from server first, fallback to localStorage
        let items = [];
        try {
            const response = await fetch('/api/saved-items');
            if (response.ok) {
                items = await response.json();
            }
        } catch (serverError) {
            console.warn('Failed to load from server, using localStorage:', serverError);
            items = JSON.parse(localStorage.getItem('generatedItems') || '[]');
        }
        
        if (items.length === 0) {
            sidebar.innerHTML += '<div class="sidebar-empty">No items yet</div>';
            return;
        }
        
        const list = document.createElement('ul');
        list.className = 'sidebar-list';
        
        items.forEach((item, i) => {
            const li = document.createElement('li');
            li.className = 'sidebar-item';
            
            // Item name
            const nameDiv = document.createElement('div');
            nameDiv.className = 'sidebar-item-name';
            nameDiv.textContent = item.name;
            li.appendChild(nameDiv);
            
            // Play button
            const playBtn = document.createElement('button');
            playBtn.className = 'lyrics-btn';
            playBtn.textContent = '▶️';
            playBtn.title = 'Play';
            playBtn.onclick = () => playItem(item, { apiForm, status, backBtn, downloadLink });
            li.appendChild(playBtn);
            
            list.appendChild(li);
        });
        
        sidebar.appendChild(list);
        
    } catch (error) {
        console.error('Error rendering sidebar:', error);
        sidebar.innerHTML += '<div class="sidebar-empty">Error loading items</div>';
    }
}

async function playItem(item, { apiForm, status, backBtn, downloadLink }) {
    try {
        // Hide form and reset status
        apiForm.style.display = 'none';
        status.textContent = 'Loading saved item...';
        backBtn.style.display = 'block';
        
        // Get player components
        let container = getOrCreateLyricsContainer();
        let controls = getOrCreateLyricsControls();
        
        // Show player components
        container.style.display = 'block';
        controls.style.display = 'flex';
        
        // Hide download links during playback
        if (downloadLink) downloadLink.style.display = 'none';
        var textDownload = document.getElementById('downloadTextLink');
        if (textDownload) textDownload.style.display = 'none';
        
        // Load text and audio
        const textResponse = await fetch(item.textUrl);
        const text = await textResponse.text();
        
        const audioResponse = await fetch(item.audioUrl);
        const audioBlob = await audioResponse.blob();
        
        // Play with word timings
        const wordTimings = await getWordTimings(text, audioBlob);
        syncTextWithAudio(text, audioBlob, wordTimings, container, controls);
        
        status.textContent = 'Playing saved item';
        
    } catch (error) {
        console.error('Error playing item:', error);
        status.textContent = 'Error loading saved item';
    }
}
