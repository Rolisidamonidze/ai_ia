const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs').promises;
require('dotenv').config();
const app = express();

const PORT = process.env.PORT || 3000;
const SAVED_ITEMS_DIR = path.join(__dirname, 'saved-items');

// Ensure saved items directory exists
async function ensureSavedItemsDir() {
  try {
    await fs.access(SAVED_ITEMS_DIR);
  } catch {
    await fs.mkdir(SAVED_ITEMS_DIR, { recursive: true });
    console.log('Created saved-items directory');
  }
}
ensureSavedItemsDir();

// Middleware
app.use(express.static(path.join(__dirname, '/')));
app.use(express.json({ limit: '50mb' }));

// CORS headers (if needed for development)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Validate API key
function validateApiKey() {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY not found in environment variables. Please add it to your .env file.');
  }
  return apiKey;
}


// Text endpoint (OpenAI ChatGPT)
app.post('/api/text', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required and must be a non-empty string' });
    }

    const apiKey = validateApiKey();
    
    console.log(`Generating text for prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ 
          role: 'user', 
          content: prompt 
        }],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return res.status(response.status).json({ 
        error: 'Failed to generate text', 
        details: data.error?.message || 'Unknown error'
      });
    }
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected API response format:', data);
      return res.status(500).json({ error: 'Unexpected response format from OpenAI' });
    }
    
    console.log('Text generated successfully');
    res.json(data);
    
  } catch (error) {
    console.error('Text API error:', error);
    res.status(500).json({ 
      error: 'Text API request failed', 
      message: error.message 
    });
  }
});


// Audio endpoint (OpenAI TTS)
app.post('/api/audio', async (req, res) => {
  try {
    const { audioInput } = req.body;
    
    if (!audioInput || typeof audioInput !== 'string' || audioInput.trim().length === 0) {
      return res.status(400).json({ error: 'audioInput is required and must be a non-empty string' });
    }

    const apiKey = validateApiKey();
    
    console.log(`Generating audio for text: "${audioInput.substring(0, 50)}${audioInput.length > 50 ? '...' : ''}"`);
    
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: audioInput,
        voice: 'alloy',
        response_format: 'mp3'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Audio generation failed', 
        details: errorText 
      });
    }
    
    console.log('Audio generated successfully');
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'attachment; filename="generated-audio.mp3"'
    });
    response.body.pipe(res);
    
  } catch (error) {
    console.error('Audio API error:', error);
    res.status(500).json({ 
      error: 'Audio API request failed', 
      message: error.message 
    });
  }
});

// Save generated item endpoint
app.post('/api/save-item', async (req, res) => {
  try {
    const { text, audioBlob } = req.body;
    
    if (!text || !audioBlob) {
      return res.status(400).json({ error: 'Text and audioBlob are required' });
    }

    const timestamp = Date.now();
    const date = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');
    const itemId = `item_${timestamp}`;
    
    // Save text file
    const textPath = path.join(SAVED_ITEMS_DIR, `${itemId}.txt`);
    await fs.writeFile(textPath, text, 'utf8');
    
    // Save audio file (convert base64 to binary)
    const audioBuffer = Buffer.from(audioBlob.replace('data:audio/mpeg;base64,', ''), 'base64');
    const audioPath = path.join(SAVED_ITEMS_DIR, `${itemId}.mp3`);
    await fs.writeFile(audioPath, audioBuffer);
    
    // Save metadata
    const metadata = {
      id: itemId,
      name: `Generated Content (${date})`,
      text,
      timestamp,
      date,
      textFile: `${itemId}.txt`,
      audioFile: `${itemId}.mp3`
    };
    
    const metaPath = path.join(SAVED_ITEMS_DIR, `${itemId}.json`);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Saved item ${itemId}`);
    res.json({ success: true, itemId, name: metadata.name });
    
  } catch (error) {
    console.error('Save item error:', error);
    res.status(500).json({ 
      error: 'Failed to save item', 
      message: error.message 
    });
  }
});

// Get saved items list
app.get('/api/saved-items', async (req, res) => {
  try {
    const files = await fs.readdir(SAVED_ITEMS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const items = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(SAVED_ITEMS_DIR, file), 'utf8');
        const metadata = JSON.parse(content);
        items.push({
          id: metadata.id,
          name: metadata.name,
          timestamp: metadata.timestamp,
          date: metadata.date,
          textUrl: `/api/saved-file/${metadata.textFile}`,
          audioUrl: `/api/saved-file/${metadata.audioFile}`
        });
      } catch (err) {
        console.warn(`Error reading metadata file ${file}:`, err.message);
      }
    }
    
    // Sort by timestamp, newest first
    items.sort((a, b) => b.timestamp - a.timestamp);
    
    res.json(items);
    
  } catch (error) {
    console.error('Load items error:', error);
    res.status(500).json({ 
      error: 'Failed to load saved items', 
      message: error.message 
    });
  }
});

// Serve saved files
app.get('/api/saved-file/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(SAVED_ITEMS_DIR, filename);
    
    // Security check - ensure file is in saved items directory
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(SAVED_ITEMS_DIR);
    if (!resolvedPath.startsWith(resolvedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.access(filePath);
    
    if (filename.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filename.endsWith('.txt')) {
      res.setHeader('Content-Type', 'text/plain');
    }
    
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.API_KEY
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ChatGPT Video Assembler server running on port ${PORT}`);
  console.log(`📍 Access the app at: http://localhost:${PORT}`);
  console.log(`🔑 API Key configured: ${process.env.API_KEY ? '✅ Yes' : '❌ No - please add to .env file'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});