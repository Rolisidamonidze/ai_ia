// Exports page management
import { createVideoFromItem } from '/modules/videoGenerator.js';

const QUEUE_KEY = 'videoExportQueue';

const getQueue = () => JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
const saveQueue = (queue) => localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

export async function loadExports() {
    try {
        const exportsGrid = document.getElementById('exportsGrid');
        const exportsEmpty = document.getElementById('exportsEmpty');
        
        const exports = JSON.parse(localStorage.getItem('videoExports') || '[]');
        
        if (exports.length === 0) {
            exportsGrid.style.display = 'none';
            exportsEmpty.style.display = 'block';
            return;
        }
        
        exportsGrid.innerHTML = '';
        exportsGrid.style.display = 'grid';
        exportsEmpty.style.display = 'none';
        
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

function renderQueue() {
    const queueSection = document.getElementById('exportsQueueSection');
    const queueList = document.getElementById('exportsQueueList');
    const queueEmpty = document.getElementById('exportsQueueEmpty');
    const queue = getQueue();
    
    if (!queueSection) return;
    
    if (!queue.length) {
        queueSection.style.display = 'none';
        queueList.innerHTML = '';
        return;
    }
    
    queueSection.style.display = 'block';
    queueList.innerHTML = '';
    queueEmpty.style.display = 'none';
    
    queue.sort((a, b) => b.createdAt - a.createdAt);
    queue.forEach(job => {
        const card = document.createElement('div');
        card.className = 'queue-card';
        
        const title = document.createElement('div');
        title.className = 'queue-card-title';
        title.textContent = job.title;
        card.appendChild(title);
        
        const meta = document.createElement('div');
        meta.className = 'queue-card-meta';
        const created = new Date(job.createdAt || Date.now());
        meta.textContent = created.toLocaleTimeString();
        const status = document.createElement('span');
        status.className = `queue-status status-${job.status || 'queued'}`;
        status.textContent = (job.status || 'queued').toUpperCase();
        meta.appendChild(status);
        card.appendChild(meta);
        
        const progress = document.createElement('div');
        progress.className = 'queue-progress';
        const fill = document.createElement('div');
        fill.className = 'queue-progress-fill';
        fill.style.width = `${job.progress || 0}%`;
        const text = document.createElement('div');
        text.className = 'queue-progress-text';
        text.textContent = `${Math.round(job.progress || 0)}%`;
        progress.appendChild(fill);
        progress.appendChild(text);
        card.appendChild(progress);
        
        const message = document.createElement('div');
        message.className = 'queue-message';
        message.textContent = job.message || 'Queued';
        card.appendChild(message);
        
        queueList.appendChild(card);
    });
}

let isProcessing = false;

async function processQueue() {
    if (isProcessing) return;
    const queue = getQueue();
    const activeJob = queue.find(j => j.status === 'processing') || queue.find(j => j.status === 'queued');
    if (!activeJob) {
        renderQueue();
        return;
    }
    
    isProcessing = true;
    activeJob.status = 'processing';
    activeJob.message = activeJob.message || 'Starting export...';
    saveQueue(queue);
    renderQueue();
    
    try {
        // Ensure we have text content
        let textContent = activeJob.text || '';
        if (!textContent && activeJob.textUrl) {
            const textResponse = await fetch(activeJob.textUrl);
            textContent = await textResponse.text();
        }
        
        const item = {
            name: activeJob.title,
            text: textContent,
            audioFile: activeJob.audioFile,
            audioUrl: activeJob.audioUrl,
            textUrl: activeJob.textUrl
        };
        
        const onProgress = ({ progress, message }) => {
            const updated = getQueue();
            const jobIdx = updated.findIndex(j => j.id === activeJob.id);
            if (jobIdx === -1) return;
            updated[jobIdx].progress = Math.round(progress || 0);
            updated[jobIdx].message = message || 'Working...';
            updated[jobIdx].status = 'processing';
            saveQueue(updated);
            renderQueue();
        };
        
        const videoBlob = await createVideoFromItem(item, activeJob.options || {}, onProgress);
        saveExport(videoBlob, activeJob.title);
        
        const updated = getQueue().filter(j => j.id !== activeJob.id);
        saveQueue(updated);
        await loadExports();
    } catch (error) {
        console.error('Export job failed:', error);
        const updated = getQueue();
        const jobIdx = updated.findIndex(j => j.id === activeJob.id);
        if (jobIdx !== -1) {
            updated[jobIdx].status = 'error';
            updated[jobIdx].message = error.message || 'Failed to export';
            saveQueue(updated);
        }
    } finally {
        isProcessing = false;
        renderQueue();
        setTimeout(processQueue, 300);
    }
}

function initExportsPage() {
    loadExports();
    renderQueue();
    processQueue();
}

document.addEventListener('DOMContentLoaded', initExportsPage);
