# ChatGPT Video Assembler

A modern web application that generates text responses using ChatGPT and converts them to audio using OpenAI's Text-to-Speech API. Features real-time word-by-word text highlighting synchronized with audio playback.

## 🚀 Features

- **AI-Powered Text Generation**: Uses ChatGPT (GPT-3.5-turbo) to generate responses from prompts
- **Text-to-Speech**: Converts generated text to high-quality audio using OpenAI's TTS API
- **Synchronized Playback**: Real-time word highlighting that follows the audio
- **Download Options**: Save both text and audio files locally
- **Responsive Design**: Beautiful UI that works on desktop and mobile
- **History Sidebar**: Keep track of previously generated content
- **Modern Tech Stack**: Built with vanilla JavaScript ES6 modules and Express.js

## 🛠️ Setup

### Prerequisites

- Node.js (v14 or higher)
- OpenAI API key

### Installation

1. **Clone or download this project**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your OpenAI API key:
   ```
   API_KEY=your_actual_openai_api_key_here
   ```

4. **Get an OpenAI API key**:
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy it to your `.env` file

5. **Start the server**:
   ```bash
   npm start
   ```

6. **Open your browser** and go to `http://localhost:3000`

## 📱 How to Use

1. **Enter a Prompt**: Type any text prompt in the input field
2. **Generate Content**: Click "Generate Content" to create AI text and audio
3. **Listen & Watch**: The text will display with synchronized highlighting as the audio plays
4. **Download**: Save the generated text and audio files for later use
5. **History**: Access previously generated content from the sidebar

## 🏗️ Project Structure

```
gpt-to-video/
├── index.html          # Main HTML page
├── style.css           # Styling and responsive design
├── app.js              # Main application logic
├── server.js           # Express.js backend server
├── package.json        # Node.js dependencies
├── modules/
│   ├── audioUtils.js   # Audio processing utilities
│   ├── domUtils.js     # DOM manipulation helpers
│   ├── sidebar.js      # Sidebar rendering logic
│   └── textSync.js     # Text-audio synchronization
└── .env.example        # Environment variables template
```

## 🎨 Design Features

- **Modern Gradient Backgrounds**: Beautiful color schemes with backdrop blur effects
- **Smooth Animations**: Hover effects and transitions throughout the UI
- **Responsive Grid Layout**: Sidebar + main content that adapts to screen size
- **Typography**: Inter font family for clean, modern text rendering
- **Interactive Elements**: Buttons with gradient backgrounds and hover states

## 🔧 Technical Details

### Frontend
- **Vanilla JavaScript**: ES6 modules for clean, modular code
- **WebGL Integration**: Ready for future video generation features
- **Audio API**: HTML5 audio with custom controls
- **Local Storage**: Persistent history of generated content

### Backend
- **Express.js**: Lightweight web server
- **OpenAI Integration**: Both Chat Completions and TTS APIs
- **Error Handling**: Comprehensive error responses and logging
- **CORS Support**: Ready for cross-origin requests if needed

## 🚨 Troubleshooting

### Common Issues

1. **"API_KEY not found" error**
   - Make sure you've created a `.env` file from `.env.example`
   - Verify your API key is correctly set in the `.env` file

2. **Audio not playing**
   - Check browser permissions for audio playback
   - Ensure your OpenAI account has TTS API access

3. **Server won't start**
   - Check if port 3000 is already in use
   - Run `npm install` to ensure dependencies are installed

### Debug Mode

Set `NODE_ENV=development` in your `.env` file for more detailed error messages.

## 📝 API Usage

The app uses two OpenAI endpoints:
- **Chat Completions API**: For text generation
- **Text-to-Speech API**: For audio generation

Current settings:
- Model: `gpt-3.5-turbo`
- Voice: `alloy`
- Max tokens: 200
- Audio format: MP3

## 🔜 Future Enhancements

- Video generation with synchronized text overlays
- Multiple voice options
- Longer content support
- Custom styling options
- Export to different formats

## 📄 License

This project is open source. Feel free to modify and distribute as needed.

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve the application.