// Main app logic for ChatGPT Video Assembler


// ffmpeg.wasm integration for MP4 export
// Add this script tag to your index.html before app.js:
// <script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.4/dist/ffmpeg.min.js"></script>

document.getElementById('apiForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const prompt = document.getElementById('prompt').value.trim();
    const status = document.getElementById('status');
    const apiForm = document.getElementById('apiForm');
    apiForm.style.display = 'none';
    status.textContent = 'Fetching response from backend...';

    // Step 1: Fetch text from backend
    let chatText;
    try {
        const chatRes = await fetch('/api/text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });
        const chatData = await chatRes.json();
        chatText = chatData.text || chatData.choices?.[0]?.message?.content || '';
    } catch (err) {
        status.textContent = 'Error fetching text from backend.';
        apiForm.style.display = 'flex';
        return;
    }
    status.textContent = 'Text received. Fetching audio...';

    // Step 2: Fetch audio from backend
    let audioBlob;
    try {
        const ttsRes = await fetch('/api/audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ audioInput: chatText })
        });
        audioBlob = await ttsRes.blob();
    } catch (err) {
        status.textContent = 'Error fetching audio from backend.';
        apiForm.style.display = 'flex';
        return;
    }
    status.textContent = 'Audio received. Assembling video...';

    // Step 3: Assemble video (Canvas + Web APIs)
    try {
        const videoBlob = await assembleVideo(chatText, audioBlob);
        status.textContent = 'Converting to MP4...';
        const mp4Blob = await convertWebMToMP4(videoBlob, audioBlob);
        const mp4Url = URL.createObjectURL(mp4Blob);
        const videoEl = document.getElementById('outputVideo');
        videoEl.src = mp4Url;
        videoEl.style.display = 'block';
        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = mp4Url;
        downloadLink.download = 'chatgpt-video.mp4';
        downloadLink.style.display = 'block';
        status.textContent = 'MP4 video ready!';
    } catch (err) {
        status.textContent = 'Error assembling or converting video.';
        console.error('Video assembly/conversion error:', err);
    }
    apiForm.style.display = 'flex';
});

// Helper: Assemble video from text and audio
async function assembleVideo(text, audioBlob) {
    // Create canvas for video frames
    const width = 1280, height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Prepare text lines
    const lines = wrapText(ctx, text, width - 100);

    // Prepare audio
    const duration = await getAudioDuration(audioBlob);
    const fps = 30;
    const totalFrames = Math.ceil(duration * fps);

    // Set up MediaRecorder
    const stream = canvas.captureStream(fps);
    const recordedChunks = [];
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    // Show progress bar
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    progressContainer.style.display = 'block';
    progressBar.value = 0;

    // Start recording
    mediaRecorder.start();

    // Animate frames
    for (let i = 0; i < totalFrames; i++) {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Draw text lines
        lines.forEach((line, idx) => {
            ctx.fillText(line, width/2, height/2 - (lines.length/2 - idx)*60);
        });
        // Update progress bar
        progressBar.value = Math.round((i + 1) / totalFrames * 100);
        await new Promise(r => setTimeout(r, 1000/fps));
    }

    // Hide progress bar
    progressContainer.style.display = 'none';

    // Stop recording after audio duration
    mediaRecorder.stop();
    await new Promise(r => mediaRecorder.onstop = r);

    // Return silent video (audio will be muxed later)
    return new Blob(recordedChunks, { type: 'video/webm' });
}

// Helper: Wrap text for canvas
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line.trim());
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line.trim());
    return lines;
}

// Helper: Get audio duration
async function getAudioDuration(blob) {
    return new Promise(resolve => {
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(blob);
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
        });
    });
}

// ffmpeg.wasm: Convert WebM and MP3 to MP4
async function convertWebMToMP4(webmBlob, audioBlob) {
    if (typeof FFmpeg === 'undefined') {
        throw new Error('FFmpeg is not defined. Make sure the FFmpeg script is loaded before app.js in your index.html.');
    }
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();
    ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webmBlob));
    ffmpeg.FS('writeFile', 'input.mp3', await fetchFile(audioBlob));
    // Mux audio and video, output MP4
    await ffmpeg.run(
        '-i', 'input.webm',
        '-i', 'input.mp3',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        'output.mp4'
    );
    const mp4Data = ffmpeg.FS('readFile', 'output.mp4');
    return new Blob([mp4Data.buffer], { type: 'video/mp4' });
}
