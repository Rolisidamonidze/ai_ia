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
        
        // Radio mode controls
        if (items.length > 1) {
            const radioControls = document.createElement('div');
            radioControls.className = 'radio-controls';
            
            const playAllBtn = document.createElement('button');
            playAllBtn.className = 'radio-btn';
            playAllBtn.textContent = '📻 Play All';
            playAllBtn.title = 'Play all items in sequence';
            playAllBtn.onclick = () => startRadioMode(items, { apiForm, status, backBtn, downloadLink });
            
            const loopToggle = document.createElement('label');
            loopToggle.className = 'loop-toggle';
            loopToggle.innerHTML = '<input type="checkbox" id="loopMode" checked> <span>Loop</span>';
            
            radioControls.appendChild(playAllBtn);
            radioControls.appendChild(loopToggle);
            sidebar.appendChild(radioControls);
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
            
            // Button container
            const btnContainer = document.createElement('div');
            btnContainer.className = 'sidebar-item-buttons';
            
            // Play button
            const playBtn = document.createElement('button');
            playBtn.className = 'lyrics-btn';
            playBtn.textContent = '▶️';
            playBtn.title = 'Play';
            playBtn.onclick = () => playItem(item, { apiForm, status, backBtn, downloadLink });
            btnContainer.appendChild(playBtn);
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'lyrics-btn delete-btn';
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${item.name}"?`)) {
                    await deleteItem(item.id);
                    renderSidebar({ apiForm, status, backBtn, downloadLink });
                }
            };
            btnContainer.appendChild(deleteBtn);
            
            li.appendChild(btnContainer);
            
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

// Radio mode: play all items in sequence
let radioPlaylist = [];
let currentRadioIndex = 0;
let isRadioMode = false;

async function startRadioMode(items, context) {
    radioPlaylist = items;
    currentRadioIndex = 0;
    isRadioMode = true;
    
    const { status } = context;
    status.textContent = 'Radio mode: Playing all items...';
    
    await playRadioItem(currentRadioIndex, context);
}

async function playRadioItem(index, context) {
    if (!isRadioMode || index >= radioPlaylist.length) {
        // Check if loop is enabled
        const loopCheckbox = document.getElementById('loopMode');
        if (loopCheckbox && loopCheckbox.checked && radioPlaylist.length > 0) {
            currentRadioIndex = 0;
            await playRadioItem(0, context);
        } else {
            isRadioMode = false;
            context.status.textContent = 'Radio mode ended';
        }
        return;
    }
    
    currentRadioIndex = index;
    const item = radioPlaylist[index];
    
    try {
        const { apiForm, status, backBtn, downloadLink } = context;
        
        // Hide form
        apiForm.style.display = 'none';
        status.textContent = `Radio: Playing ${index + 1}/${radioPlaylist.length} - ${item.name}`;
        backBtn.style.display = 'block';
        
        // Highlight current item in sidebar
        document.querySelectorAll('.sidebar-item').forEach((el, i) => {
            if (i === index) {
                el.classList.add('playing');
            } else {
                el.classList.remove('playing');
            }
        });
        
        // Get player components
        let container = getOrCreateLyricsContainer();
        let controls = getOrCreateLyricsControls();
        
        container.style.display = 'block';
        controls.style.display = 'flex';
        
        if (downloadLink) downloadLink.style.display = 'none';
        var textDownload = document.getElementById('downloadTextLink');
        if (textDownload) textDownload.style.display = 'none';
        
        // Load text and audio
        const textResponse = await fetch(item.textUrl);
        const text = await textResponse.text();
        
        const audioResponse = await fetch(item.audioUrl);
        const audioBlob = await audioResponse.blob();
        
        // Play with word timings and callback for next item
        const wordTimings = await getWordTimings(text, audioBlob);
        syncTextWithAudio(text, audioBlob, wordTimings, container, controls, () => {
            // When this item ends, play next
            if (isRadioMode) {
                setTimeout(() => playRadioItem(currentRadioIndex + 1, context), 500);
            }
        });
        
        status.textContent = `Radio: ${index + 1}/${radioPlaylist.length} - ${item.name}`;
        
    } catch (error) {
        console.error('Error in radio mode:', error);
        // Skip to next item on error
        if (isRadioMode) {
            setTimeout(() => playRadioItem(currentRadioIndex + 1, context), 500);
        }
    }
}

// Export stop radio function for back button
export function stopRadioMode() {
    isRadioMode = false;
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('playing'));
}

// Delete item function
async function deleteItem(itemId) {
    try {
        const response = await fetch(`/api/saved-item/${itemId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Item deleted:', itemId);
        return true;
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete item: ' + error.message);
        return false;
    }
}
