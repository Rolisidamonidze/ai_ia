const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '/')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Text endpoint (OpenAI ChatGPT)
app.post('/api/text', async (req, res) => {
  try {
    const { prompt } = req.body;
    const apiKey = process.env.API_KEY;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Text API request failed' });
  }
});


// Audio endpoint (OpenAI TTS)
app.post('/api/audio', async (req, res) => {
  try {
    const { audioInput } = req.body;
    const apiKey = process.env.API_KEY;
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
      return res.status(500).json({ error: 'Audio API request failed', details: errorText });
    }
    res.set('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Audio API request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});