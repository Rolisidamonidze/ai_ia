const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs').promises;
require('dotenv').config();

// Initialize Firebase Admin
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let db, bucket;
try {
  // Try to initialize with service account (for local development)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  } else {
    // For production (Firebase Functions), use default credentials
    admin.initializeApp({
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }
  
  db = admin.firestore();
  bucket = admin.storage().bucket();
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  console.log('⚠️  App will continue but Firebase features will not work');
}

const app = express();
const PORT = process.env.PORT || 3000;
const SAVED_ITEMS_DIR = path.join(__dirname, 'saved-items');

// Keep this for backwards compatibility/local fallback
async function ensureSavedItemsDir() {
  try {
    await fs.access(SAVED_ITEMS_DIR);
  } catch {
    await fs.mkdir(SAVED_ITEMS_DIR, { recursive: true });
    console.log('Created saved-items directory');
  }
}

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
        messages: [
          { 
            role: 'system', 
            content: 'When generating affirmations or similar content, do not use numbered lists or bullet points. Write each statement on a new line without any numbering, bullets, or other markers. Just write the affirmations naturally, one per line.'
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        max_tokens: 2000,
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
    const { audioInput, voice } = req.body;
    
    if (!audioInput || typeof audioInput !== 'string' || audioInput.trim().length === 0) {
      return res.status(400).json({ error: 'audioInput is required and must be a non-empty string' });
    }

    const apiKey = validateApiKey();
    
    // Validate voice or use default
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'alloy';
    
    console.log(`Generating audio for text: "${audioInput.substring(0, 50)}${audioInput.length > 50 ? '...' : ''}" with voice: ${selectedVoice}`);
    
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: audioInput,
        voice: selectedVoice,
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

// Generate title endpoint (using GPT)
app.post('/api/generate-title', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const apiKey = validateApiKey();
    
    // Create a better prompt for generating a natural, human-readable title
    const prompt = `Based on the following text, create a short, natural, and descriptive title (3-8 words maximum). The title should capture the main theme or topic. Do not use quotes. Return ONLY the title:\n\n${text.substring(0, 600)}`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a title generator. Create short, natural, human-readable titles that capture the essence of the text. Never use quotes or generic phrases like "Generated Content".' 
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        max_tokens: 30,
        temperature: 0.8
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error for title:', data);
      // Fallback to a timestamp-based title if API fails
      const date = new Date().toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return res.json({ title: `Content from ${date}` });
    }
    
    let title = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Clean up the title
    title = title.replace(/^["']|["']$/g, '');  // Remove quotes
    title = title.replace(/^Title:\s*/i, '');    // Remove "Title:" prefix
    title = title.replace(/\.$/, '');             // Remove trailing period
    
    // If title is too generic or empty, create a descriptive one
    if (!title || title.length < 3 || title.toLowerCase().includes('generated content')) {
      const firstWords = text.trim().split(/\s+/).slice(0, 5).join(' ');
      title = firstWords.length > 40 ? firstWords.substring(0, 40) + '...' : firstWords;
    }
    
    console.log('Title generated:', title);
    res.json({ title });
    
  } catch (error) {
    console.error('Generate title error:', error);
    // Fallback to first few words of the text
    const firstWords = req.body.text?.trim().split(/\s+/).slice(0, 5).join(' ') || 'Untitled';
    const fallbackTitle = firstWords.length > 40 ? firstWords.substring(0, 40) + '...' : firstWords;
    res.json({ title: fallbackTitle });
  }
});

// Save generated item endpoint
app.post('/api/save-item', async (req, res) => {
  try {
    const { text, audioBlob, title, playlist } = req.body;
    
    if (!text || !audioBlob) {
      return res.status(400).json({ error: 'Text and audioBlob are required' });
    }

    const timestamp = Date.now();
    const date = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');
    const itemId = `item_${timestamp}`;
    
    console.log(`Saving item ${itemId}...`);
    
    // Use provided title or create a better fallback based on text content
    let itemName = title;
    if (!itemName) {
      const words = text.trim().split(/\s+/).slice(0, 6);
      const preview = words.join(' ');
      itemName = preview.length > 50 ? preview.substring(0, 50) + '...' : preview;
      
      if (itemName.length < 10) {
        itemName = `Content from ${new Date(timestamp).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;
      }
    }
    
    // Save to Firebase
    if (db && bucket) {
      // Save audio to Firebase Storage
      const base64Data = audioBlob.includes(',') ? audioBlob.split(',')[1] : audioBlob;
      const audioBuffer = Buffer.from(base64Data, 'base64');
      
      const audioFile = bucket.file(`audio/${itemId}.mp3`);
      await audioFile.save(audioBuffer, {
        contentType: 'audio/mpeg',
        metadata: {
          cacheControl: 'public, max-age=31536000',
        }
      });
      
      // Make audio file publicly readable
      await audioFile.makePublic();
      const audioUrl = `https://storage.googleapis.com/${bucket.name}/audio/${itemId}.mp3`;
      
      // Save text to Firebase Storage
      const textFile = bucket.file(`text/${itemId}.txt`);
      await textFile.save(text, {
        contentType: 'text/plain',
        metadata: {
          cacheControl: 'public, max-age=31536000',
        }
      });
      
      await textFile.makePublic();
      const textUrl = `https://storage.googleapis.com/${bucket.name}/text/${itemId}.txt`;
      
      // Save metadata to Firestore
      const metadata = {
        id: itemId,
        name: itemName,
        text,
        timestamp,
        date,
        audioUrl,
        textUrl,
        playlist: playlist || 'default'
      };
      
      await db.collection('items').doc(itemId).set(metadata);
      
      console.log(`✅ Saved item ${itemId} to Firebase`);
      res.json({ success: true, itemId, name: metadata.name });
    } else {
      // Fallback to local file system
      await ensureSavedItemsDir();
      
      // Save text file
      const textPath = path.join(SAVED_ITEMS_DIR, `${itemId}.txt`);
      await fs.writeFile(textPath, text, 'utf8');
      
      // Save audio file
      const base64Data = audioBlob.includes(',') ? audioBlob.split(',')[1] : audioBlob;
      const audioBuffer = Buffer.from(base64Data, 'base64');
      const audioPath = path.join(SAVED_ITEMS_DIR, `${itemId}.mp3`);
      await fs.writeFile(audioPath, audioBuffer);
      
      // Save metadata
      const metadata = {
        id: itemId,
        name: itemName,
        text,
        timestamp,
        date,
        textFile: `${itemId}.txt`,
        audioFile: `${itemId}.mp3`,
        playlist: playlist || 'default'
      };
      
      const metaPath = path.join(SAVED_ITEMS_DIR, `${itemId}.json`);
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
      
      console.log(`Saved item ${itemId} (local fallback)`);
      res.json({ success: true, itemId, name: metadata.name });
    }
    
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
    if (db) {
      // Use Firebase Firestore
      const snapshot = await db.collection('items').orderBy('timestamp', 'desc').get();
      const items = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        items.push({
          id: data.id,
          name: data.name,
          timestamp: data.timestamp,
          date: data.date,
          textUrl: data.textUrl,
          audioUrl: data.audioUrl,
          playlist: data.playlist || 'default'
        });
      });
      
      res.json(items);
    } else {
      // Fallback to local file system
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
            audioUrl: `/api/saved-file/${metadata.audioFile}`,
            playlist: metadata.playlist || 'default'
          });
        } catch (err) {
          console.warn(`Error reading metadata file ${file}:`, err.message);
        }
      }
      
      items.sort((a, b) => b.timestamp - a.timestamp);
      res.json(items);
    }
    
  } catch (error) {
    console.error('Load items error:', error);
    res.status(500).json({ 
      error: 'Failed to load saved items', 
      message: error.message 
    });
  }
});

// Get items grouped by playlist
app.get('/api/playlists', async (req, res) => {
  try {
    if (db) {
      // Use Firebase Firestore
      const snapshot = await db.collection('items').orderBy('timestamp', 'desc').get();
      const playlists = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const playlistName = data.playlist || 'default';
        
        if (!playlists[playlistName]) {
          playlists[playlistName] = [];
        }
        
        playlists[playlistName].push({
          id: data.id,
          name: data.name,
          timestamp: data.timestamp,
          date: data.date,
          textUrl: data.textUrl,
          audioUrl: data.audioUrl,
          playlist: playlistName
        });
      });
      
      res.json(playlists);
    } else {
      // Fallback to local file system
      const files = await fs.readdir(SAVED_ITEMS_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const playlists = {};
      
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(SAVED_ITEMS_DIR, file), 'utf8');
          const metadata = JSON.parse(content);
          const playlistName = metadata.playlist || 'default';
          
          if (!playlists[playlistName]) {
            playlists[playlistName] = [];
          }
          
          playlists[playlistName].push({
            id: metadata.id,
            name: metadata.name,
            timestamp: metadata.timestamp,
            date: metadata.date,
            textUrl: `/api/saved-file/${metadata.textFile}`,
            audioUrl: `/api/saved-file/${metadata.audioFile}`,
            playlist: playlistName
          });
        } catch (err) {
          console.warn(`Error reading metadata file ${file}:`, err.message);
        }
      }
      
      Object.keys(playlists).forEach(playlistName => {
        playlists[playlistName].sort((a, b) => b.timestamp - a.timestamp);
      });
      
      res.json(playlists);
    }
    
  } catch (error) {
    console.error('Load playlists error:', error);
    res.status(500).json({ 
      error: 'Failed to load playlists', 
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

// Delete item endpoint
app.delete('/api/saved-item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    console.log(`Delete request for item: ${itemId}`);
    
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    
    if (db && bucket) {
      // Delete from Firebase
      // Delete audio file from Storage
      const audioFile = bucket.file(`audio/${itemId}.mp3`);
      await audioFile.delete().catch(err => console.warn(`Audio file not found: ${err.message}`));
      
      // Delete text file from Storage
      const textFile = bucket.file(`text/${itemId}.txt`);
      await textFile.delete().catch(err => console.warn(`Text file not found: ${err.message}`));
      
      // Delete metadata from Firestore
      await db.collection('items').doc(itemId).delete();
      
      console.log(`✅ Successfully deleted item ${itemId} from Firebase`);
      res.json({ success: true, itemId });
    } else {
      // Fallback to local file system
      const metaPath = path.join(SAVED_ITEMS_DIR, `${itemId}.json`);
      const textPath = path.join(SAVED_ITEMS_DIR, `${itemId}.txt`);
      const audioPath = path.join(SAVED_ITEMS_DIR, `${itemId}.mp3`);
      
      const results = await Promise.allSettled([
        fs.unlink(metaPath),
        fs.unlink(textPath),
        fs.unlink(audioPath)
      ]);
      
      results.forEach((result, i) => {
        const files = [metaPath, textPath, audioPath];
        if (result.status === 'fulfilled') {
          console.log(`Deleted: ${files[i]}`);
        } else {
          console.warn(`Failed to delete ${files[i]}:`, result.reason?.message);
        }
      });
      
      console.log(`Successfully processed delete for item ${itemId}`);
      res.json({ success: true, itemId });
    }
    
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ 
      error: 'Failed to delete item', 
      message: error.message 
    });
  }
});

// Update item playlist endpoint
app.patch('/api/saved-item/:itemId/playlist', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { playlist } = req.body;
    
    console.log(`Update playlist for item ${itemId} to: ${playlist}`);
    
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    
    if (!playlist || typeof playlist !== 'string') {
      return res.status(400).json({ error: 'Playlist name is required' });
    }
    
    if (db) {
      // Update in Firebase Firestore
      await db.collection('items').doc(itemId).update({
        playlist: playlist
      });
      
      console.log(`✅ Successfully updated playlist for item ${itemId} in Firebase`);
      res.json({ success: true, itemId, playlist });
    } else {
      // Fallback to local file system
      const metaPath = path.join(SAVED_ITEMS_DIR, `${itemId}.json`);
      
      const content = await fs.readFile(metaPath, 'utf8');
      const metadata = JSON.parse(content);
      
      metadata.playlist = playlist;
      
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
      
      console.log(`Successfully updated playlist for item ${itemId}`);
      res.json({ success: true, itemId, playlist });
    }
    
  } catch (error) {
    console.error('Update playlist error:', error);
    res.status(500).json({ 
      error: 'Failed to update playlist', 
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.API_KEY,
    firebaseInitialized: !!(db && bucket)
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

// Only start server if not running in Firebase Functions
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 ChatGPT Video Assembler server running on port ${PORT}`);
    console.log(`📍 Access the app at: http://localhost:${PORT}`);
    console.log(`🔑 API Key configured: ${process.env.API_KEY ? '✅ Yes' : '❌ No - please add to .env file'}`);
    console.log(`🔥 Firebase initialized: ${(db && bucket) ? '✅ Yes' : '❌ No - using local storage'}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
  });
}

// Export for Firebase Functions
module.exports = app;