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
    sidebar.innerHTML = '<h2>Playlists</h2>';
    
    try {
        // Load playlists grouped by folder
        let playlists = {};
        try {
            const response = await fetch('/api/playlists');
            if (response.ok) {
                playlists = await response.json();
            }
        } catch (serverError) {
            console.warn('Failed to load playlists from server:', serverError);
            // Fallback to localStorage if server fails
            const items = JSON.parse(localStorage.getItem('generatedItems') || '[]');
            playlists = { 'default': items };
        }
        
        if (Object.keys(playlists).length === 0) {
            sidebar.innerHTML += '<div class="sidebar-empty">No items yet</div>';
            return;
        }
        
        const playlistNames = Object.keys(playlists).sort();
        
        // Collect all items from all playlists
        const allItems = [];
        playlistNames.forEach(name => {
            allItems.push(...playlists[name]);
        });
        
        // Global controls with loop toggle and play all button
        const globalControls = document.createElement('div');
        globalControls.className = 'radio-controls';
        
        const playAllBtn = document.createElement('button');
        playAllBtn.className = 'global-play-all';
        playAllBtn.textContent = '▶️ Play All';
        playAllBtn.title = 'Play all items from all playlists';
        playAllBtn.onclick = () => {
            if (allItems.length > 0) {
                startRadioMode(allItems, { apiForm, status, backBtn, downloadLink });
            }
        };
        globalControls.appendChild(playAllBtn);
        
        const loopToggle = document.createElement('label');
        loopToggle.className = 'loop-toggle';
        loopToggle.innerHTML = '<input type="checkbox" id="loopMode" checked> <span>Loop</span>';
        globalControls.appendChild(loopToggle);
        sidebar.appendChild(globalControls);
        
        // Render each playlist as a folder
        playlistNames.forEach(playlistName => {
            const items = playlists[playlistName];
            if (items.length === 0) return;
            
            const playlistDiv = document.createElement('div');
            playlistDiv.className = 'playlist-folder';
            
            // Playlist header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'playlist-header';
            
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'playlist-toggle';
            toggleBtn.textContent = '📁';
            toggleBtn.title = 'Toggle folder';
            
            const playlistNameSpan = document.createElement('span');
            playlistNameSpan.className = 'playlist-name';
            playlistNameSpan.textContent = playlistName;
            
            const itemCount = document.createElement('span');
            itemCount.className = 'playlist-count';
            itemCount.textContent = `(${items.length})`;
            
            const playAllBtn = document.createElement('button');
            playAllBtn.className = 'playlist-play-all';
            playAllBtn.textContent = '▶️';
            playAllBtn.title = 'Play all in this playlist';
            playAllBtn.onclick = (e) => {
                e.stopPropagation();
                startRadioMode(items, { apiForm, status, backBtn, downloadLink });
            };
            
            headerDiv.appendChild(toggleBtn);
            headerDiv.appendChild(playlistNameSpan);
            headerDiv.appendChild(itemCount);
            headerDiv.appendChild(playAllBtn);
            
            // Make playlist header a drop zone
            headerDiv.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                headerDiv.classList.add('drag-over');
            };
            
            headerDiv.ondragleave = (e) => {
                headerDiv.classList.remove('drag-over');
            };
            
            headerDiv.ondrop = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                headerDiv.classList.remove('drag-over');
                
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const { itemId, fromPlaylist } = data;
                    const toPlaylist = playlistName;
                    
                    // Don't move if already in this playlist
                    if (fromPlaylist === toPlaylist) return;
                    
                    // Update item playlist via API
                    const response = await fetch(`/api/saved-item/${itemId}/playlist`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ playlist: toPlaylist })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to move item');
                    }
                    
                    // Refresh sidebar
                    renderSidebar({ apiForm, status, backBtn, downloadLink });
                    
                } catch (error) {
                    console.error('Error moving item:', error);
                    alert('Failed to move item: ' + error.message);
                }
            };
            
            // Items list (collapsible)
            const itemsList = document.createElement('ul');
            itemsList.className = 'playlist-items';
            itemsList.style.display = 'block'; // Start expanded
            
            items.forEach((item, i) => {
                const li = document.createElement('li');
                li.className = 'sidebar-item';
                li.draggable = true;
                li.dataset.itemId = item.id;
                li.dataset.playlist = playlistName;
                
                // Drag start event
                li.ondragstart = (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        itemId: item.id,
                        fromPlaylist: playlistName
                    }));
                    li.classList.add('dragging');
                };
                
                // Drag end event
                li.ondragend = (e) => {
                    li.classList.remove('dragging');
                    document.querySelectorAll('.playlist-header').forEach(h => {
                        h.classList.remove('drag-over');
                    });
                };
                
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
                itemsList.appendChild(li);
            });
            
            // Toggle folder expansion
            headerDiv.onclick = () => {
                const isExpanded = itemsList.style.display === 'block';
                itemsList.style.display = isExpanded ? 'none' : 'block';
                toggleBtn.textContent = isExpanded ? '📁' : '📂';
            };
            
            playlistDiv.appendChild(headerDiv);
            playlistDiv.appendChild(itemsList);
            sidebar.appendChild(playlistDiv);
        });
        
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
        
        // Highlight current item in sidebar by matching data-item-id
        document.querySelectorAll('.sidebar-item').forEach((el) => {
            if (el.dataset.itemId === item.id) {
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
