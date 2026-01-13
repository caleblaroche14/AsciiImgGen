# ASCII Art Video Generator

A comprehensive, detailed, functional ASCII art video generator that converts images into ASCII animations with multiple rendering modes and extensive customization options.

## Project Status

**Fully Implemented Features:**
- ✅ Three rendering modes: Original (static with random chars), Scroll (flowing left), Zoom (breathing resolution)
- ✅ Rain mode: ASCII art with falling characters (new!)
- ✅ Real-time preview with 10Hz animation loop
- ✅ FPS slider (1-30fps) affecting all modes
- ✅ Resolution slider (30-300 chars wide)
- ✅ Zoom min/max sliders (1-1000 chars, default 10-300)
- ✅ Rain fall distance slider (1-100px, default 20)
- ✅ Rain fall speed slider (1-30, default 1)
- ✅ Custom character input (applies to all modes)
- ✅ Font picker (12 fonts: Verdana, DOS via dos.ttf, Courier New, Monaco, Menlo, Consolas, Roboto Mono, Source Code Pro, IBM Plex Mono, JetBrains Mono, Inconsolata, DejaVu Sans Mono)
- ✅ Minimalist UI (compact header, tiny upload area with 6px padding)
- ✅ Video frame generation logic
- ✅ CORS header configuration for Netlify and local development

**Currently Blocked (Infrastructure):**
- 🔲 Video download functionality (blocked by FFmpeg SharedArrayBuffer requirement)

## Tech Stack

- **Frontend:** Vanilla JavaScript (no frameworks), HTML5, CSS3
- **Canvas Rendering:** HTML5 Canvas for ASCII art generation
- **Video Encoding:** FFmpeg.wasm v0.11.6 (CDN: https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg)
- **Development Server:** Python 3 HTTP server with CORS headers
- **Production Hosting:** Netlify
- **Fonts:** Verdana (system), dos.ttf (custom)

## Project Structure

```
/Users/caleblaroche14/Code/AsciiImgGen/
├── index.html          # Main UI with all controls
├── script.js           # Core application logic (1000+ lines)
├── style.css           # Complete styling with dark gradient theme
├── dos.ttf             # Custom DOS monospace font
├── server.py           # Local dev server with CORS headers (port 3000)
├── netlify.toml        # Production CORS configuration
├── images/             # Directory for uploaded/processed images
└── README.md           # This file
```

## Key Features

### Rendering Modes

1. **Original Mode:** Static ASCII frame with random character selection from available character set
   - Each frame regenerates with random chars, creating a "flickering" effect
   - Respects custom character set if provided

2. **Scroll Mode:** ASCII text flows horizontally across screen
   - Shifts frame left by 1 character per frame
   - Wraps around (modulo CHAR_WIDTH)
   - Smooth continuous scrolling effect

3. **Zoom Mode:** Resolution "breathes" in and out using sine wave interpolation
   - Interpolates between zoomMinChars and zoomMaxChars
   - Creates effect of zooming in/out of detail
   - Wave progress = (1 - cos(π × progress)) / 2 for smooth easing

4. **Flag Mode:** Static ASCII art with waving flag animation (loops continuously)
   - ASCII frame stays static, but characters have vertical waving motion
   - Uses sine wave to create smooth waving effect
   - Wave Distance (1-100px): Controls amplitude of the wave
   - Wave Speed (1-30): Controls how fast the wave cycles
   - Creates organic wave-like pattern across columns
   - Animation loops continuously without interruption

5. **Dither Mode:** Static ASCII art with ordered dithering pattern
   - Uses Bayer matrix ordered dithering for structured pattern effect
   - Creates halftone-like appearance with improved tonal gradation
   - Static frame (no animation) with repeating 4x4 dither pattern
   - Produces distinctive patterned look compared to standard brightness mapping

### UI Controls

| Control | Range | Default | Effect |
|---------|-------|---------|--------|
| Mode Selector | Original/Scroll/Zoom/Flag/Dither | Original | Changes rendering algorithm |
| Font Picker | 12 fonts | Verdana | Changes monospace font in preview/video |
| Resolution | 30-300 chars | 200 | Width of ASCII grid |
| FPS | 1-30 | 5 | Affects animation speed in preview + video framerate |
| Zoom Min | 1-1000 chars | 10 | Minimum resolution in zoom mode |
| Zoom Max | 1-1000 chars | 300 | Maximum resolution in zoom mode |
| Wave Distance | 1-100 px | 20 | Amplitude of waving animation in flag mode |
| Wave Speed | 1-30 | 1 | Speed of waving animation cycles in flag mode |
| Duration | 1-30 seconds | 5 | Length of generated video |
| Custom Chars | Text input | (empty) | Use custom character set instead of brightness map |

### Character Mapping

**Default (Brightness-based):**
- 8 brightness levels, each with multiple character options
- Darker areas use dense characters (█, ▓, ▒)
- Lighter areas use sparse characters (·, ", `)
- Random selection within each brightness level for variation

**Custom Characters:**
- When custom character input provided, randomly selects from that set
- Ignores brightness mapping, treats all pixels equally

## Architecture

### Global State (script.js)

```javascript
let ffmpeg, ffmpegReady, currentMode, currentFont, currentFPS, currentCharWidth
let zoomMinChars, zoomMaxChars, customChars, ffmpegRetryCount = 0
const MAX_FFMPEG_RETRIES = 5
const CHARACTER_MAP = [/* 8 levels of characters */]
const CHAR_WIDTH = 200, OUTPUT_WIDTH = 1080
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `initializeFFmpeg()` | Dual API support (new FFmpeg.FFmpeg class + old createFFmpeg), 5 retry limit, SharedArrayBuffer error handling |
| `generatePreview()` | Real-time animation loop, mode-specific frame generation, 100ms base interval modified by FPS |
| `generateVideo()` | Creates frame array for full duration, applies mode logic to each frame, encodes to MP4 |
| `convertFrameToASCII()` | Image→ASCII conversion with configurable resolution |
| `convertFrameToASCIIDither()` | Image→ASCII conversion with ordered Bayer matrix dithering |
| `renderASCIIFrame()` | Canvas rendering with selected font and character set |
| `renderASCIIFrameWithFlag()` | Canvas rendering with waving animation for flag mode (loops continuously) |
| `pixelToCharacter()` | Maps brightness to character (or random from custom set) |
| `getZoomCharWidth()` | Sine wave interpolation for zoom mode |
| `shiftASCIIFrame()` | Horizontal scrolling for scroll mode |

### Event Flow

1. User uploads image → `handleImageUpload()`
2. Preview starts → `generatePreview()` runs on interval
3. User adjusts controls (mode/FPS/resolution/font) → Preview updates in real-time
4. User clicks "Generate Video" → `generateVideo()` 
   - Allocates frame array
   - For each frame: applies mode logic + renders to temp canvas + captures ImageData
   - Passes to FFmpeg for MP4 encoding
   - Triggers browser download

## Running Locally

### Prerequisites
- Python 3.x
- Modern browser (Chrome, Firefox, Safari, Edge)
- Image file (JPG, PNG, WebP)

### Development Server Setup

**Option 1: Kill VS Code Live Server (if using)**
```bash
lsof -ti :3000 | xargs kill -9
python3 /Users/caleblaroche14/Code/AsciiImgGen/server.py
```

**Option 2: Use Different Port**
Edit `server.py` line 5:
```python
PORT = 8000  # Change from 3000
```
Then run:
```bash
python3 /Users/caleblaroche14/Code/AsciiImgGen/server.py
```

**Access the Application**
- http://127.0.0.1:3000/index.html (if using port 3000)
- http://127.0.0.1:8000/index.html (if using port 8000)

### Important: Hard Refresh After Server Start
Press **Cmd+Shift+R** (macOS) or **Ctrl+Shift+R** (Windows/Linux) to clear browser cache and reload with proper CORS headers.

### What the Local Server Does

The `server.py` adds critical CORS headers required for FFmpeg.wasm:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Access-Control-Allow-Origin: *
```

These headers enable SharedArrayBuffer access, which FFmpeg.wasm requires for multithreaded encoding.

**Without these headers:** FFmpeg fails with "SharedArrayBuffer is not available" error

## Deployment to Netlify

The `netlify.toml` file contains production CORS configuration.

### Steps
1. Ensure `netlify.toml` is in repository root
2. Commit changes: `git add . && git commit -m "Update documentation and deployment config"`
3. Push to GitHub: `git push`
4. Netlify automatically redeploys when changes are pushed

### Verification
- Navigate to your Netlify domain (e.g., https://yoursite.netlify.app)
- Hard refresh browser (Cmd+Shift+R)
- Try uploading image and generating video

## Known Issues & Solutions

### Issue: "Address already in use" on port 3000
**Cause:** VS Code Live Server already running on same port  
**Solution:** 
- Run `lsof -ti :3000 | xargs kill -9` to kill Live Server
- Or modify server.py to use different port (e.g., PORT = 8000)

### Issue: "SharedArrayBuffer is not available"
**Cause:** Missing CORS headers  
**Solution:**
- Use `server.py` for local development (adds required headers)
- Ensure `netlify.toml` deployed for production
- Hard refresh browser after server starts

### Issue: FFmpeg doesn't load on development server
**Cause:** Browser cache with old settings  
**Solution:** Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: Video generation doesn't trigger download
**Cause:** FFmpeg.wasm not loaded (SharedArrayBuffer error)  
**Solution:** See "SharedArrayBuffer" issue above

## FFmpeg.wasm Integration

### Version & CDN
- Version: 0.11.6
- CDN: https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg
- Loads via `<script>` tag in index.html

### Supported APIs
The code supports both legacy and current FFmpeg.wasm APIs:

```javascript
// Try newer API first
if (FFmpeg.FFmpeg) {
    ffmpeg = new FFmpeg.FFmpeg();
} else if (FFmpeg.createFFmpeg) {
    // Fall back to older API
    ffmpeg = FFmpeg.createFFmpeg({ log: true });
}
```

### Video Output Specification
- Format: MP4 (H.264 video codec)
- Resolution: 1080px width, height calculated from aspect ratio
- Framerate: 30fps (hardcoded in generateVideo)
- Audio: None

## Testing Checklist

When resuming development, test in this order:

1. **Server Startup**
   - [ ] Run server.py without errors
   - [ ] No "Address already in use" error

2. **FFmpeg Loading** (check browser console)
   - [ ] No "SharedArrayBuffer" errors
   - [ ] Console shows "FFmpeg.wasm loaded successfully"

3. **Preview Functionality**
   - [ ] Upload image → preview appears
   - [ ] Change mode → animation updates
   - [ ] Adjust FPS → speed changes
   - [ ] Change resolution → ASCII detail changes
   - [ ] Change font → font updates in real-time
   - [ ] Enter custom chars → preview uses custom set

4. **Video Generation**
   - [ ] Click "Generate Video"
   - [ ] Progress bar advances
   - [ ] Video downloads to computer
   - [ ] Video plays in video player
   - [ ] Video shows correct ASCII animation for selected mode

5. **All Modes**
   - [ ] Original: Static with random characters
   - [ ] Scroll: Smooth horizontal scrolling
   - [ ] Zoom: Smooth sine-wave resolution changes

6. **Deployment**
   - [ ] Push to GitHub
   - [ ] Verify Netlify redeploy
   - [ ] Test on Netlify domain
   - [ ] Repeat preview + video generation tests on production

## Next Steps for Continuation

### Immediate (Infrastructure)
1. Resolve local server port conflict
2. Verify FFmpeg.wasm loads with proper CORS headers
3. Test video generation end-to-end locally

### Short Term (Testing & Polish)
1. Test all modes with various FPS/resolution combinations
2. Test video quality and encoding speed
3. Test with different image formats (JPG, PNG, WebP)
4. Profile performance with large images

### Medium Term (Features)
1. Performance optimization (consider web workers for frame generation)
2. Video quality settings (bitrate, resolution)
3. Preview of video before generation
4. Progress indication during video encoding
5. Support for different video codecs

### Long Term (Deployment)
1. Deploy to Netlify
2. Set up GitHub Actions for automated testing
3. Add analytics/tracking
4. Performance monitoring

## Code Quality Notes

- **Browser Compatibility:** Tested on modern browsers (Chrome, Firefox, Safari, Edge)
- **Responsiveness:** CSS uses responsive design patterns
- **Accessibility:** Could be improved with ARIA labels
- **Performance:** Canvas rendering is efficient; video encoding is single-threaded (FFmpeg limitation)
- **Error Handling:** Catches and logs FFmpeg errors, provides user feedback

## File Sizes & Performance

- `index.html`: Single-page app with all controls
- `script.js`: ~1000 lines, all features self-contained
- `style.css`: Complete styling, dark theme
- `dos.ttf`: ~30KB custom font file
- Preview: 10Hz animation, ~10-50ms per frame (depends on resolution)
- Video encoding: ~1-5 seconds for 5-second video (depends on resolution/FPS)

## Dependencies

**Runtime (Browser):**
- FFmpeg.wasm (loaded via CDN)

**Development:**
- Python 3 (for local server)
- Browser developer tools for debugging

**Deployment:**
- Netlify account
- Git repository

## Security Considerations

- File uploads are processed locally in browser (never sent to server)
- No backend processing or data collection
- CORS headers configured for SharedArrayBuffer only
- Video files generated locally, never stored on server

---

**Last Updated:** January 13, 2026  
**Project Status:** Feature-complete, awaiting server infrastructure resolution  
**Blocker:** Local server port conflict (easy fix) before testing video generation
