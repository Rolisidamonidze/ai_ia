// Minimal exports manager for sidebar integration
// Provides saveExport() used by sidebar.js

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
        
        console.log('[ExportsManager] Video export saved:', exportItem);
        return exportItem;
    } catch (error) {
        console.error('[ExportsManager] Error saving export:', error);
        throw error;
    }
}
