
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

// ...existing code...


// DOM elements
const apiForm = document.getElementById('apiForm');
const status = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const videoEl = document.getElementById('outputVideo');
const downloadLink = document.getElementById('downloadLink');

apiForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    apiForm.style.display = 'none';
    status.textContent = 'Fetching response...';
    progressContainer.style.display = 'block';
    progressBar.value = 0;

    try {
        // 1. Get text
        const prompt = document.getElementById('prompt').value.trim();
        const chatRes = await fetch('/api/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        const chatData = await chatRes.json();
        const chatText = chatData.text || chatData.choices?.[0]?.message?.content || '';
        status.textContent = 'Text received. Fetching audio...';

        // 2. Get audio
        const ttsRes = await fetch('/api/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioInput: chatText })
        });
        const audioBlob = await ttsRes.blob();
        status.textContent = 'Audio received. Playing with lyrics...';

        // 3. Display text in sync with audio
        await displayTextWithAudio(chatText, audioBlob);
        status.textContent = 'Done!';
    } catch (err) {
        status.textContent = 'Error: ' + (err.message || err);
        console.error(err);
    }
    progressContainer.style.display = 'none';
    apiForm.style.display = 'flex';
});


// Display text in sync with audio like a lyrics app
async function displayTextWithAudio(text, audioBlob) {
    // Create or get lyrics container
    let container = document.getElementById('lyricsContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'lyricsContainer';
        container.style.font = 'bold 32px Arial';
        container.style.background = '#222';
        container.style.color = '#fff';
        container.style.padding = '40px';
        container.style.textAlign = 'center';
        container.style.margin = '20px auto';
        container.style.width = '80%';
        container.style.borderRadius = '16px';
        document.body.appendChild(container);
    }
    // Hide video and download elements if present
    if (videoEl) videoEl.style.display = 'none';
    if (downloadLink) downloadLink.style.display = 'none';

    // Prepare audio
    const audio = new Audio();
    audio.src = URL.createObjectURL(audioBlob);

    // Split text into lines
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = 'bold 48px Arial';
    const lines = wrapText(ctx, text, 600);

    // Estimate duration per line
    const duration = await getAudioDuration(audioBlob);
    const perLine = duration / lines.length;

    // Display lines in sync with audio
    let currentLine = 0;
    container.textContent = '';
    audio.play();

    function updateLyrics() {
        const time = audio.currentTime;
        const newLine = Math.min(Math.floor(time / perLine), lines.length - 1);
        if (newLine !== currentLine) {
            currentLine = newLine;
            container.textContent = lines.slice(0, currentLine + 1).join('\n');
        }
        if (!audio.paused && currentLine < lines.length - 1) {
            requestAnimationFrame(updateLyrics);
        }
    }
    audio.onplay = () => requestAnimationFrame(updateLyrics);
    audio.onended = () => { container.textContent = lines.join('\n'); };
    // Optionally auto-scroll to lyrics
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

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
async function getAudioDuration(blob) {
    return new Promise(resolve => {
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(blob);
        audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    });
}
