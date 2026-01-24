// Exports page management
export async function loadExports() {
    try {
        const exportsGrid = document.getElementById('exportsGrid');
        const exportsEmpty = document.getElementById('exportsEmpty');
        
        // Get exports from localStorage
        const exports = JSON.parse(localStorage.getItem('videoExports') || '[]');
        
        if (exports.length === 0) {
            exportsGrid.style.display = 'none';
            exportsEmpty.style.display = 'block';
            return;
        }
        
        exportsGrid.innerHTML = '';
        
        // Sort by date, newest first
        exports.sort((a, b) => b.timestamp - a.timestamp);
        
        exports.forEach(exportItem => {
            const card = document.createElement('div');
            card.className = 'export-card';
            
            const videoContainer = document.createElement('div');
            videoContainer.className = 'export-card-video';
            
            const video = document.createElement('video');
            video.src = exportItem.videoUrl;
            video.controls = false;
            videoContainer.appendChild(video);
            
            const content = document.createElement('div');
            content.className = 'export-card-content';
            
            const title = document.createElement('div');
            title.className = 'export-card-title';
            title.textContent = exportItem.title;
            
            const date = document.createElement('div');
            date.className = 'export-card-date';
            const exportDate = new Date(exportItem.timestamp);
            date.textContent = exportDate.toLocaleDateString() + ' ' + exportDate.toLocaleTimeString();
            
            const actions = document.createElement('div');
            actions.className = 'export-card-actions';
            
            const downloadBtn = document.createElement('a');
            downloadBtn.href = exportItem.videoUrl;
            downloadBtn.download = exportItem.filename;
            downloadBtn.className = 'export-card-btn export-download-btn';
            downloadBtn.textContent = '📥 Download';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'export-card-btn export-delete-btn';
            deleteBtn.textContent = '🗑️ Delete';
            deleteBtn.onclick = () => deleteExport(exportItem.id, card);
            
            actions.appendChild(downloadBtn);
            actions.appendChild(deleteBtn);
            
            content.appendChild(title);
            content.appendChild(date);
            content.appendChild(actions);
            
            card.appendChild(videoContainer);
            card.appendChild(content);
            
            exportsGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading exports:', error);
    }
}

export function saveExport(videoBlob, title) {
    try {
        const videoUrl = URL.createObjectURL(videoBlob);
        const timestamp = Date.now();
        const id = 'export_' + timestamp;
        const filename = title.replace(/[^a-z0-9]/gi, '_') + '_' + timestamp + '.webm';
        
        const exportItem = {
            id,
            title,
            filename,
            videoUrl,
            timestamp
        };
        
        const exports = JSON.parse(localStorage.getItem('videoExports') || '[]');
        exports.push(exportItem);
        localStorage.setItem('videoExports', JSON.stringify(exports));
        
        console.log('Video export saved:', exportItem);
        return exportItem;
    } catch (error) {
        console.error('Error saving export:', error);
        throw error;
    }
}

export function deleteExport(id, cardElement) {
    if (!confirm('Delete this export?')) return;
    
    try {
        const exports = JSON.parse(localStorage.getItem('videoExports') || '[]');
        const filtered = exports.filter(e => e.id !== id);
        localStorage.setItem('videoExports', JSON.stringify(filtered));
        
        if (cardElement) {
            cardElement.remove();
            const exportsGrid = document.getElementById('exportsGrid');
            if (exportsGrid.children.length === 0) {
                document.getElementById('exportsEmpty').style.display = 'block';
                exportsGrid.style.display = 'none';
            }
        }
        
        console.log('Export deleted:', id);
    } catch (error) {
        console.error('Error deleting export:', error);
    }
}

// Load exports on page load
document.addEventListener('DOMContentLoaded', loadExports);
