# Video Generation Feature

## Overview
The video generation feature allows you to convert any saved item (text + audio) into a video with synchronized text display.

## How to Use

### 1. Create Video from Saved Items
- Click the **🎬 video button** next to any saved item in the sidebar
- Configure video options:
  - **Animate Background Colors**: Enables color transitions between sentences
  - **Video Quality**: Choose between Low (5 fps, fastest), Medium (10 fps), or High (30 fps, slowest)
- Click to start generation
- Wait for the video to be created (progress bar shows status)
- Preview the video in the browser
- Download the video as `.webm` format

### 2. Video Generation Process
1. **Loading**: Loads the text and audio from the saved item
2. **Frame Generation**: Creates visual frames with text overlays
3. **FFmpeg Processing**: Uses ffmpeg.wasm to encode video with audio
4. **Output**: Produces a WebM video file

## Technical Details

### Video Specifications
- **Format**: WebM (VP8 video + Vorbis audio)
- **Resolution**: 1280x720 (HD)
- **FPS**: 5-30 (configurable)
- **Bitrate**: 1 Mbps
- **Text**: Centered, wrapped, with shadow for readability

### Features
- **Sentence-by-sentence display**: Text splits into sentences, each shown for a portion of the video
- **Gradient backgrounds**: Optional animated background colors
- **Synchronized audio**: Original audio from the item is included
- **Browser-based**: All processing happens in the browser using ffmpeg.wasm

### Performance Notes
- **Low Quality (5 fps)**: Fastest generation, smaller file size
- **Medium Quality (10 fps)**: Balanced generation time and smoothness
- **High Quality (30 fps)**: Slowest generation, smoothest animation, larger file size

## Browser Requirements
- Modern browser with WebAssembly support
- Sufficient memory (recommend 4GB+ free RAM)
- FFmpeg.wasm library (automatically loaded)

## Tips
- Start with Low or Medium quality for faster results
- High quality is best for final exports
- Animated backgrounds work well with longer content
- Video generation can take 1-5 minutes depending on quality and content length

## Troubleshooting

### Video Generation Fails
- Check browser console for specific errors
- Ensure you have enough free memory
- Try reducing quality to Low
- Refresh the page and try again

### Video File is Too Large
- Use Lower quality setting (5 fps)
- Consider splitting very long content into multiple items

### Audio Not Synced
- This should not happen as audio and video are generated together
- If it does, try regenerating the video

## Future Enhancements
- Custom fonts and colors
- Multiple text animation styles
- Background images or patterns
- Export to MP4 format
- Batch video generation
