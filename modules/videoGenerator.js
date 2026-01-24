// Video Generator Module
// Creates videos from text and audio with synchronized text display

let ffmpegInstance = null;
let ffmpegLoading = false;

// Initialize FFmpeg instance (singleton)
async function getFFmpeg() {
    if (ffmpegInstance) return ffmpegInstance;
    
    if (ffmpegLoading) {
        // Wait for existing load to complete
        while (ffmpegLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return ffmpegInstance;
    }
    
    ffmpegLoading = true;
    try {
        console.log('[VideoGenerator] Creating FFmpeg instance...');
        const ffmpegLib = (typeof window !== 'undefined' && window.FFmpeg) ? window.FFmpeg : null;
        const createFFmpeg = ffmpegLib && ffmpegLib.createFFmpeg ? ffmpegLib.createFFmpeg : null;
        if (!createFFmpeg) {
            throw new Error('createFFmpeg is not available on window. Make sure ffmpeg.min.js is loaded.');
        }
        ffmpegInstance = createFFmpeg({
            corePath: '/ffmpeg-core/ffmpeg-core.js',
            log: true
        });
        
        if (ffmpegInstance.setLogger) {
            ffmpegInstance.setLogger(({ message }) => {
                console.log('[FFmpeg]', message);
            });
        }

        if (ffmpegInstance.setProgress) {
            ffmpegInstance.setProgress(({ ratio }) => {
                console.log(`[FFmpeg] Progress: ${Math.round(ratio * 100)}%`);
            });
        }
        
        console.log('[VideoGenerator] Loading FFmpeg core...');
        await ffmpegInstance.load();
        console.log('[VideoGenerator] FFmpeg loaded successfully');
        
        return ffmpegInstance;
    } catch (error) {
        console.error('[VideoGenerator] Failed to load FFmpeg:', error);
        ffmpegInstance = null;
        throw error;
    } finally {
        ffmpegLoading = false;
    }
}

// Helper: Convert blob to Uint8Array
async function blobToUint8Array(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
}

// Helper: Wrap text to fit within canvas width
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

// Create a single video frame with text
function createFrame(text, width, height, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Background
    const bgColor = options.backgroundColor || '#1a1a2e';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    
    // Optional gradient background
    if (options.gradientBackground) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, options.gradientColor1 || '#1a1a2e');
        gradient.addColorStop(1, options.gradientColor2 || '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    // Text
    const fontSize = options.fontSize || 48;
    const fontFamily = options.fontFamily || 'Arial, sans-serif';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = options.textColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Wrap text
    const maxWidth = width * 0.85;
    const lines = wrapText(ctx, text, maxWidth);
    
    // Draw text
    const lineHeight = fontSize * 1.5;
    const totalHeight = lines.length * lineHeight;
    const startY = (height - totalHeight) / 2 + lineHeight / 2;
    
    // Add text shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    lines.forEach((line, index) => {
        const y = startY + index * lineHeight;
        ctx.fillText(line, width / 2, y);
    });
    
    return canvas;
}

// Generate video frames based on text content
async function generateFrames(text, duration, fps = 30, options = {}) {
    console.log(`[VideoGenerator] Generating frames: ${fps}fps for ${duration}s`);
    
    const width = options.width || 1280;
    const height = options.height || 720;
    const totalFrames = Math.ceil(duration * fps);
    const frames = [];
    
    // Split text into sentences or chunks
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 0);
    
    // Calculate frames per sentence
    const framesPerSentence = Math.floor(totalFrames / cleanSentences.length);
    
    console.log(`[VideoGenerator] Creating ${totalFrames} frames for ${cleanSentences.length} sentences`);
    
    for (let i = 0; i < cleanSentences.length; i++) {
        const sentence = cleanSentences[i];
        const canvas = createFrame(sentence, width, height, {
            ...options,
            backgroundColor: options.animateBackground ? 
                `hsl(${(i * 360 / cleanSentences.length)}, 40%, 15%)` : options.backgroundColor
        });
        
        // Convert canvas to blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
        });
        
        // Add same frame multiple times (one per sentence duration)
        const numFrames = i === cleanSentences.length - 1 ? 
            totalFrames - (i * framesPerSentence) : framesPerSentence;
        
        for (let j = 0; j < numFrames; j++) {
            frames.push(blob);
        }
    }
    
    console.log(`[VideoGenerator] Generated ${frames.length} frames`);
    return frames;
}

// Create video from text and audio
export async function createVideoFromItem(item, options = {}, onProgress = null) {
    try {
        console.log('[VideoGenerator] Starting video creation for:', item.name);
        
        if (onProgress) onProgress({ stage: 'init', progress: 0, message: 'Initializing...' });
        
        // Load audio
        let audioBlob;
        if (item.audioFile) {
            // Load from saved file
            const audioResponse = await fetch(`/saved-items/${item.audioFile}`);
            if (!audioResponse.ok) throw new Error('Failed to load audio file');
            audioBlob = await audioResponse.blob();
        } else if (item.audioUrl) {
            // Load from URL (for legacy items)
            const audioResponse = await fetch(item.audioUrl);
            audioBlob = await audioResponse.blob();
        } else {
            throw new Error('No audio source found');
        }
        
        if (onProgress) onProgress({ stage: 'audio', progress: 10, message: 'Audio loaded' });
        
        // Get audio duration
        const audioDuration = await getAudioDuration(audioBlob);
        console.log(`[VideoGenerator] Audio duration: ${audioDuration}s`);
        
        if (onProgress) onProgress({ stage: 'frames', progress: 20, message: 'Generating video frames...' });
        
        // Generate frames
        const fps = options.fps || 5; // Lower FPS for faster generation
        const frames = await generateFrames(item.text, audioDuration, fps, options);
        
        if (onProgress) onProgress({ stage: 'frames', progress: 40, message: `Generated ${frames.length} frames` });
        
        // Initialize FFmpeg
        const ffmpeg = await getFFmpeg();
        
        if (onProgress) onProgress({ stage: 'ffmpeg', progress: 50, message: 'Writing frames to FFmpeg...' });
        
        // Write frames as individual images
        for (let i = 0; i < frames.length; i++) {
            const frameData = await blobToUint8Array(frames[i]);
            const paddedIndex = String(i).padStart(5, '0');
            ffmpeg.FS('writeFile', `frame_${paddedIndex}.png`, frameData);
            
            if (i % 10 === 0 && onProgress) {
                const progress = 50 + (i / frames.length) * 20;
                onProgress({ 
                    stage: 'ffmpeg', 
                    progress, 
                    message: `Writing frame ${i + 1}/${frames.length}...` 
                });
            }
        }
        
        if (onProgress) onProgress({ stage: 'ffmpeg', progress: 70, message: 'Writing audio...' });
        
        // Write audio
        const audioData = await blobToUint8Array(audioBlob);
        ffmpeg.FS('writeFile', 'audio.mp3', audioData);
        
        if (onProgress) onProgress({ stage: 'encoding', progress: 75, message: 'Encoding video...' });
        
        // Create video from frames and audio
        console.log('[VideoGenerator] Running FFmpeg encoding...');
        await ffmpeg.run(
            '-framerate', String(fps),
            '-i', 'frame_%05d.png',
            '-i', 'audio.mp3',
            '-c:v', 'libvpx',
            '-c:a', 'libvorbis',
            '-shortest',
            '-pix_fmt', 'yuv420p',
            '-b:v', '1M',
            'output.webm'
        );
        
        if (onProgress) onProgress({ stage: 'reading', progress: 90, message: 'Reading output...' });
        
        // Read output
        const videoData = ffmpeg.FS('readFile', 'output.webm');
        const videoBlob = new Blob([videoData], { type: 'video/webm' });
        
        if (onProgress) onProgress({ stage: 'cleanup', progress: 95, message: 'Cleaning up...' });
        
        // Cleanup (delete temporary files)
        try {
            ffmpeg.FS('unlink', 'audio.mp3');
            ffmpeg.FS('unlink', 'output.webm');
            for (let i = 0; i < frames.length; i++) {
                const paddedIndex = String(i).padStart(5, '0');
                ffmpeg.FS('unlink', `frame_${paddedIndex}.png`);
            }
        } catch (cleanupError) {
            console.warn('[VideoGenerator] Cleanup warning:', cleanupError);
        }
        
        if (onProgress) onProgress({ stage: 'complete', progress: 100, message: 'Video created!' });
        
        console.log('[VideoGenerator] Video created successfully');
        return videoBlob;
        
    } catch (error) {
        console.error('[VideoGenerator] Error creating video:', error);
        throw error;
    }
}

// Helper to get audio duration
async function getAudioDuration(audioBlob) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
        });
        audio.addEventListener('error', reject);
        audio.src = URL.createObjectURL(audioBlob);
    });
}

// Generate quick preview (first frame only)
export async function generatePreview(text, options = {}) {
    const width = options.width || 640;
    const height = options.height || 360;
    
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const firstSentence = sentences[0].trim();
    
    const canvas = createFrame(firstSentence, width, height, options);
    return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
    });
}
