// Main app logic for ChatGPT Video Assembler


// ffmpeg.wasm integration for MP4 export
// Add this script tag to your index.html before app.js:
// <script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.4/dist/ffmpeg.min.js"></script>

document.getElementById('apiForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    // Hardcoded API key
    // Get API key from input and store in localStorage
    const apiKeyInput = document.getElementById('apiKey');
    const apiKey = apiKeyInput.value.trim();
    localStorage.setItem('openai_api_key', apiKey);
    const prompt = document.getElementById('prompt').value.trim();
    const status = document.getElementById('status');
    // Hide input and button
    const apiForm = document.getElementById('apiForm');
    apiForm.style.display = 'none';
    status.textContent = 'Fetching response from ChatGPT...';
    // Restore API key from localStorage if available
    if (localStorage.getItem('openai_api_key')) {
        apiKeyInput.value = localStorage.getItem('openai_api_key');
    }

    // Step 1: Fetch text from ChatGPT (OpenAI API)
    let chatText;
    try {
        const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{role: 'user', content: prompt}],
                max_tokens: 200
            })
        });
        const chatData = await chatRes.json();
        chatText = chatData.choices?.[0]?.message?.content || '';
    } catch (err) {
        status.textContent = 'Error fetching text from ChatGPT.';
        return;
    }
    status.textContent = 'Text received. Fetching audio...';

    // Step 2: Fetch audio from OpenAI TTS API
    let audioBlob;
    try {
        const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: chatText,
                voice: 'alloy',
                response_format: 'mp3'
            })
        });
        audioBlob = await ttsRes.blob();
    } catch (err) {
        status.textContent = 'Error fetching audio from OpenAI.';
        return;
    }
    status.textContent = 'Audio received. Assembling video...';

    // Step 3: Assemble video (Canvas + Web APIs)
    try {
        const videoBlob = await assembleVideo(chatText, audioBlob);
        // Convert to MP4
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
    // Show input and button again
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
