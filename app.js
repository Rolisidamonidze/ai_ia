import { syncTextWithAudio, getWordTimings } from './modules/textSync.js';
import { getOrCreateLyricsContainer, getOrCreateLyricsControls } from './modules/domUtils.js';
import { getAudioDuration } from './modules/audioUtils.js';
import { getOrCreateSidebar, renderSidebar } from './modules/sidebar.js';

// Simplified ChatGPT Video Assembler (WebM only)
// Requires ffmpeg.wasm loaded in index.html

// --- WebGL Frame Renderer ---
// Creates a WebGL context and renders a colored rectangle (as an example)
function createWebGLRenderer(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL not supported');

    // Simple vertex and fragment shaders
    const vertCode = `
        attribute vec2 coordinates;
        void main(void) {
            gl_Position = vec4(coordinates, 0.0, 1.0);
        }
    `;
    const fragCode = `
        precision mediump float;
        uniform vec4 uColor;
        void main(void) {
            gl_FragColor = uColor;
        }
    `;

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    const vertShader = compileShader(gl.VERTEX_SHADER, vertCode);
    const fragShader = compileShader(gl.FRAGMENT_SHADER, fragCode);
    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Program link failed: ' + gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    // Rectangle covering the whole canvas
    const vertices = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const coord = gl.getAttribLocation(program, 'coordinates');
    gl.vertexAttribPointer(coord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(coord);

    const colorLoc = gl.getUniformLocation(program, 'uColor');

    // Render a frame with a given color (RGBA)
    function renderFrame(r, g, b, a = 1.0) {
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform4f(colorLoc, r, g, b, a);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return canvas;
    }

    return { canvas, renderFrame };
}

// Example usage: Generate N frames with different colors using WebGL
async function generateWebGLFrames(numFrames, width, height) {
    const renderer = createWebGLRenderer(width, height);
    const frames = [];
    for (let i = 0; i < numFrames; i++) {
        // Animate color (cycle through hues)
        const hue = (i / numFrames) * 360;
        const [r, g, b] = hslToRgb(hue / 360, 1, 0.5);
        renderer.renderFrame(r, g, b, 1.0);
        // Convert canvas to Blob (PNG or JPEG)
        const blob = await new Promise(res => renderer.canvas.toBlob(res, 'image/webp'));
        frames.push(blob);
    }
    return frames;
}

// Helper: Convert HSL to RGB (0-1 range)
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s == 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
}

// DOM elements
const apiForm = document.getElementById('apiForm');
const status = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const downloadLink = document.getElementById('downloadLink');

// Add a back button for step-by-step UX
let backBtn = document.getElementById('backBtn');
if (!backBtn) {
    backBtn = document.createElement('button');
    backBtn.id = 'backBtn';
    backBtn.textContent = '← Back';
    backBtn.className = 'lyrics-btn';
    backBtn.style.display = 'none';
    backBtn.onclick = () => {
        // Show form again
        apiForm.style.display = 'flex';
        status.textContent = '';
        backBtn.style.display = 'none';
        
        // Reset submit button
        const submitBtn = apiForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Generate Content';
        }
        
        // Hide progress container
        if (progressContainer) {
            progressContainer.style.display = 'none';
            progressBar.value = 0;
        }
        
        // Hide player components
        const container = document.getElementById('lyricsContainer');
        if (container) container.style.display = 'none';
        const controls = document.getElementById('lyricsControls');
        if (controls) controls.style.display = 'none';
        
        // Hide download links
        if (downloadLink) downloadLink.style.display = 'none';
        let textDownload = document.getElementById('downloadTextLink');
        if (textDownload) textDownload.style.display = 'none';
        
        // Reset any playing audio
        const audio = document.querySelector('audio');
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    };
    // Don't append yet - wait for controls to be created
}

apiForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = apiForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Disable form and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating...';
    apiForm.style.display = 'none';
    status.textContent = 'Initializing...';
    progressContainer.style.display = 'block';
    progressBar.value = 10;

    try {
        // 1. Get text
        const prompt = document.getElementById('prompt').value.trim();
        if (!prompt) {
            throw new Error('Please enter a prompt');
        }
        
        status.textContent = 'Fetching response from ChatGPT...';
        progressBar.value = 20;
        
        const chatRes = await fetch('/api/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        if (!chatRes.ok) {
            throw new Error(`Failed to get text response: ${chatRes.status}`);
        }
        
        const chatData = await chatRes.json();
        const chatText = chatData.text || chatData.choices?.[0]?.message?.content || '';
        
        if (!chatText) {
            throw new Error('No text received from ChatGPT');
        }
        
        progressBar.value = 50;
        status.textContent = 'Text received. Generating audio...';

        // 2. Get audio
        const ttsRes = await fetch('/api/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioInput: chatText })
        });
        
        if (!ttsRes.ok) {
            throw new Error(`Failed to generate audio: ${ttsRes.status}`);
        }
        
        const audioBlob = await ttsRes.blob();
        progressBar.value = 80;
        status.textContent = 'Audio generated. Setting up playback...';

        // Save audio locally (non-blocking - happens in background)
        saveGeneratedItem(chatText, audioBlob).then(itemInfo => {
            console.log('Item saved with title:', itemInfo.name);
            // Update sidebar after save completes
            renderSidebar({ apiForm, status, backBtn, downloadLink });
        }).catch(err => {
            console.error('Background save failed:', err);
        });
        
        const timestamp = Date.now();
        if (downloadLink) {
            downloadLink.style.display = '';
            downloadLink.href = URL.createObjectURL(audioBlob);
            downloadLink.download = `audio-${timestamp}.mp3`;
            downloadLink.textContent = `Download Audio`;
        }
        
        // Save text locally (show download link for text)
        var textDownload = document.getElementById('downloadTextLink');
        if (!textDownload) {
            textDownload = document.createElement('a');
            textDownload.id = 'downloadTextLink';
            textDownload.className = 'download-link';
            downloadLink.parentNode.insertBefore(textDownload, downloadLink.nextSibling);
        }
        textDownload.style.display = '';
        textDownload.href = URL.createObjectURL(new Blob([chatText], {type: 'text/plain'}));
        textDownload.download = `text-${timestamp}.txt`;
        textDownload.textContent = `Download Text`;
        
        progressBar.value = 90;
        
        // 3. Display text in sync with audio (word-level)
        const container = getOrCreateLyricsContainer();
        const controls = getOrCreateLyricsControls();
        
        // Hide form and downloads first
        apiForm.style.display = 'none';
        if (downloadLink) downloadLink.style.display = 'none';
        if (textDownload) textDownload.style.display = 'none';
        
        // Show player components
        container.style.display = 'block';
        controls.style.display = 'flex';
        
        // Add back button to controls if not already there
        if (backBtn && !controls.contains(backBtn)) {
            controls.appendChild(backBtn);
        }
        
        const wordTimings = await getWordTimings(chatText, audioBlob);
        syncTextWithAudio(chatText, audioBlob, wordTimings, container, controls);
        
        progressBar.value = 100;
        status.textContent = 'Ready to play! Use controls above.';
        backBtn.style.display = 'block';
        
        // Update sidebar
        await renderSidebar({ apiForm, status, backBtn, downloadLink });
        
        // Hide progress after a delay
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);
        
    } catch (err) {
        console.error('Error:', err);
        status.textContent = 'Error: ' + (err.message || err);
        status.style.background = 'rgba(239, 68, 68, 0.1)';
        status.style.color = '#dc2626';
        
        // Reset form
        apiForm.style.display = '';
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        backBtn.style.display = 'none';
        
        // Reset status style after delay
        setTimeout(() => {
            status.style.background = 'rgba(255, 255, 255, 0.5)';
            status.style.color = '#4b5563';
        }, 5000);
    } finally {
        // Always reset button state if form is visible
        if (apiForm.style.display !== 'none') {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
        
        // Hide progress if there was an error
        if (status.textContent.includes('Error')) {
            progressContainer.style.display = 'none';
        }
    }
});

// Mux video and audio into a single WebM using ffmpeg.wasm
async function muxWebM(videoBlob, audioBlob) {
    // Always mux video and audio using ffmpeg.wasm to guarantee audio in output
    function blobToUint8Array(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }
    console.log('[muxWebM] Converting videoBlob to Uint8Array...');
    const webmData = await blobToUint8Array(videoBlob);
    console.log('[muxWebM] Converting audioBlob to Uint8Array...');
    const audioData = await blobToUint8Array(audioBlob);
    console.log('[muxWebM] Creating FFmpeg instance...');
    // Set corePath to help ffmpeg.wasm find its core files
    // Adjust './ffmpeg-core/ffmpeg-core.js' if your core files are in a different folder
    const ffmpeg = new FFmpegWASM.FFmpeg({
        corePath: './ffmpeg-core.js'
    });
    ffmpeg.on('log', msg => console.log('[FFmpeg log]', msg));
    ffmpeg.on('progress', p => console.log('[FFmpeg progress]', p));
    ffmpeg.on('error', err => console.error('[FFmpeg error]', err));
    ['log', 'progress', 'error', 'done', 'start', 'exit'].forEach(event => {
        try {
            ffmpeg.on(event, (...args) => console.log(`[FFmpeg event:${event}]`, ...args));
        } catch (e) {}
    });
    console.log('[muxWebM] Loading ffmpeg.wasm...');
    await ffmpeg.load();
    console.log('[muxWebM] Writing input.webm...');
    await ffmpeg.writeFile('input.webm', webmData);
    console.log('[muxWebM] Writing input.mp3...');
    await ffmpeg.writeFile('input.mp3', audioData);
    console.log('[muxWebM] Running ffmpeg.exec...');
    await ffmpeg.exec([
        '-i', 'input.webm',
        '-i', 'input.mp3',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'libvorbis',
        '-preset', 'ultrafast',
        '-shortest',
        'output.webm'
    ]);
    console.log('[muxWebM] Reading output.webm...');
    const webmOutData = await ffmpeg.readFile('output.webm');
    console.log('[muxWebM] Muxing complete. Returning Blob.');
    return new Blob([webmOutData], { type: 'video/webm' });
}

// Helpers
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' '), lines = [];
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && n > 0) {
            lines.push(line.trim()); line = words[n] + ' ';
        } else { line = testLine; }
    }
    lines.push(line.trim());
    return lines;
}

// Save item to server
async function saveGeneratedItem(text, audioBlob) {
    try {
        // Generate title using GPT
        let title = null;
        try {
            console.log('Generating title...');
            const titleResponse = await fetch('/api/generate-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            if (titleResponse.ok) {
                const titleData = await titleResponse.json();
                title = titleData.title;
                console.log('Generated title:', title);
            }
        } catch (titleError) {
            console.warn('Failed to generate title, using default:', titleError);
        }
        
        // Convert blob to base64
        const audioBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(audioBlob);
        });
        
        const response = await fetch('/api/save-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text, 
                audioBlob: audioBase64,
                title 
            })
        });
        
        if (!response.ok) {
            throw new Error(`Save failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Item saved successfully:', result.itemId);
        return { name: result.name, idx: result.itemId };
        
    } catch (error) {
        console.error('Failed to save item:', error);
        // Fallback to old localStorage method if server fails
        const items = JSON.parse(localStorage.getItem('generatedItems') || '[]');
        const idx = items.length + 1;
        const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const name = `Item ${idx} (${date}) [Local]`;
        items.push({
            name,
            text,
            audioUrl: URL.createObjectURL(audioBlob),
            textUrl: URL.createObjectURL(new Blob([text], {type: 'text/plain'})),
            timestamp: Date.now()
        });
        localStorage.setItem('generatedItems', JSON.stringify(items));
        return { name, idx };
    }
}

// On load, render sidebar
(async () => {
    await renderSidebar({ apiForm, status, backBtn, downloadLink });
})();
