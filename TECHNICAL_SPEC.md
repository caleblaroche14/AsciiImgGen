# AsciiImgGen - Technical Specification

## Project Overview

**AsciiImgGen** is an HD live ASCII art video generator that converts uploaded images into high-resolution colored ASCII art videos optimized for social media platforms (Instagram Reels, TikTok, etc.).

**Core Concept**: Transform static images into dynamic ASCII art representations where each character's density represents pixel brightness and each character is colored to match the averaged pixel color in its region.

---

## Technical Specifications

### Output Video Specifications
- **Resolution**: 1080x1920px (portrait, Instagram Reels format)
- **Framerate**: 30fps
- **Format**: MP4 (H.264 codec)
- **Duration**: Single frame repeated for 3-5 seconds (configurable)
- **Color Depth**: 24-bit RGB (8-bit per channel)

### ASCII Art Grid Specifications
- **Character Width**: 120 characters (fitted to 1080px canvas width)
- **Character Height**: 200+ characters (calculated based on image aspect ratio)
- **Character Region Size**: ~9-10px × ~9-10px per character cell
- **Font**: Monospace (Courier New or Monaco)
- **Font Size**: Calculated dynamically to fit 1080px width across 120 characters

### Character Mapping
**Brightness-to-Character Mapping** (light to dark):
```
Space (0x20)  → 0-12.5% brightness
Period (.)    → 12.5-25% brightness
Colon (:)     → 25-37.5% brightness
Hyphen (-)    → 37.5-50% brightness
Equals (=)    → 50-62.5% brightness
Plus (+)      → 62.5-75% brightness
Asterisk (*)  → 75-87.5% brightness
Hash (#)      → 87.5-100% brightness
```

**Color Representation**: Each character is rendered in the averaged RGB color of its pixel region.

---

## Architecture Overview

### Component Structure

```
index.html
├── File Input Handler
├── Canvas Elements
│   ├── Temporary Canvas (image processing)
│   └── Output Canvas (ASCII rendering)
├── Progress UI
└── Download Handler

script.js
├── ImageProcessor
│   ├── loadImage(file)
│   ├── drawToCanvas(img)
│   └── getImageData()
├── ASCIIConverter
│   ├── pixelToCharacter(brightness)
│   ├── sampleRegion(x, y, width, height)
│   ├── convertFrameToASCII()
│   └── CHARACTER_MAP
├── CanvasRenderer
│   ├── renderASCIIFrame(asciiData, colorData)
│   ├── calculateFontSize()
│   └── drawCharacter(char, x, y, color)
├── VideoEncoder
│   ├── initFFmpeg()
│   ├── encodeToMP4(frames, duration)
│   └── updateProgress(percent)
└── UIController
    ├── handleFileInput()
    ├── updateProgressBar()
    └── downloadVideo()

style.css
├── Layout & Containers
├── Canvas Styling
├── Progress Bar
└── Button Styling
```

---

## Core Functions & Algorithms

### 1. Image Loading & Processing

```javascript
/**
 * Load image from file input and prepare for processing
 * @param {File} file - Image file from input
 * @returns {Promise<ImageData>} Processed image data
 */
loadImage(file)

/**
 * Draw image to temporary canvas for pixel access
 * @param {HTMLImageElement} img
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D}
 */
drawToCanvas(img, canvas)
```

### 2. Pixel Sampling & Averaging

```javascript
/**
 * Sample and average pixel colors in a rectangular region
 * @param {ImageData} imageData
 * @param {number} startX - Region start X coordinate
 * @param {number} startY - Region start Y coordinate
 * @param {number} width - Region width in pixels
 * @param {number} height - Region height in pixels
 * @returns {Object} { r, g, b, brightness }
 */
sampleRegion(imageData, startX, startY, width, height)

/**
 * Calculate perceived brightness using luminance formula
 * @param {number} r, g, b - RGB values (0-255)
 * @returns {number} Brightness (0-1)
 */
calculateBrightness(r, g, b)
// Formula: 0.299*r + 0.587*g + 0.114*b
```

### 3. Character Mapping

```javascript
/**
 * Map brightness value to ASCII character
 * @param {number} brightness - Brightness value (0-1)
 * @returns {string} ASCII character
 */
pixelToCharacter(brightness)

/**
 * Convert image region to ASCII art frame
 * @param {ImageData} imageData
 * @param {number} charWidth - Character grid width (120)
 * @returns {Object} { characters: string[][], colors: rgb[][] }
 */
convertFrameToASCII(imageData, charWidth)
```

### 4. Canvas Rendering

```javascript
/**
 * Calculate font size to fit output canvas width
 * @param {number} canvasWidth - Output canvas width (1080)
 * @param {number} charCount - Character count (120)
 * @returns {number} Font size in pixels
 */
calculateFontSize(canvasWidth, charCount)

/**
 * Render ASCII frame to output canvas
 * @param {Object} asciiFrame - { characters, colors }
 * @param {HTMLCanvasElement} canvas
 * @param {number} fontSize
 */
renderASCIIFrame(asciiFrame, canvas, fontSize)

/**
 * Draw single character at position with color
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} char
 * @param {number} x, y - Position in characters
 * @param {number} fontSize
 * @param {Object} color - { r, g, b }
 */
drawCharacter(ctx, char, x, y, fontSize, color)
```

### 5. Video Encoding (FFmpeg.wasm)

```javascript
/**
 * Initialize FFmpeg instance
 * @returns {Promise<void>}
 */
initFFmpeg()

/**
 * Encode canvas frames to MP4 video
 * @param {Object[]} frames - Array of canvas ImageData
 * @param {number} duration - Video duration in seconds
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Blob>} MP4 video blob
 */
encodeToMP4(frames, duration, onProgress)

/**
 * Callback to update UI progress bar
 * @param {number} percent - Progress percentage (0-100)
 */
updateProgress(percent)
```

---

## File Structure

```
AsciiImgGen/
├── index.html           # Main HTML structure
├── script.js            # Core logic & functionality
├── style.css            # UI styling
├── TECHNICAL_SPEC.md    # This file
└── README.md            # User documentation (TBD)
```

---

## Dependencies & Libraries

### External Libraries
- **FFmpeg.wasm** - Video encoding (MP4 generation)
  - CDN: `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js`
  - WASM Binary: Auto-loaded from CDN

### Browser APIs
- **Canvas API** - Image processing and rendering
- **FileReader API** - Image file loading
- **Blob API** - Video file generation and download
- **Web Workers** (optional) - Offload FFmpeg encoding to background thread

---

## Implementation Workflow

### 1. User Flow
1. User uploads image via file input
2. Image loaded and converted to canvas
3. Progress bar appears, shows encoding status
4. ASCII frames generated and rendered to output canvas (for preview)
5. Frames encoded to MP4 video using FFmpeg
6. Download button enabled, user can download video

### 2. Processing Pipeline
```
Input Image File
    ↓
Load via FileReader
    ↓
Draw to Temporary Canvas
    ↓
Get ImageData (pixel array)
    ↓
Sample regions, average colors
    ↓
Map brightness to characters
    ↓
Render ASCII to output canvas (preview)
    ↓
Replicate frames for duration
    ↓
Encode to MP4 via FFmpeg
    ↓
Generate downloadable blob
```

---

## Color & Brightness Calculation

### RGB to Brightness (Luminance)
Uses weighted luminance formula (ITU-R BT.601):
```
Brightness = 0.299 * R + 0.587 * G + 0.114 * B
Normalized = Brightness / 255
```

### Character Selection Algorithm
```
brightness = calculateBrightness(r, g, b)
if brightness < 0.125:
    char = ' '
else if brightness < 0.25:
    char = '.'
else if brightness < 0.375:
    char = ':'
... (continue for all 8 levels)
else:
    char = '#'
```

---

## Video Encoding Details

### FFmpeg Parameters
- **Codec**: libx264 (H.264)
- **Preset**: medium (balance speed/quality)
- **CRF**: 23 (quality: 0-51, lower is better, 23 is default)
- **Framerate**: 30fps
- **Pixel Format**: yuv420p (compatibility)

### Frame Generation
- Render ASCII art to canvas once
- Duplicate canvas frames for target duration
- Pass all frames to FFmpeg for encoding

### Output
- MP4 file with H.264 video stream
- Audio: None (optional: add silence or background music later)
- Container: MP4 (MPEG-4 Part 14)

---

## Performance Considerations

### Optimization Strategies
1. **Canvas Rendering**: Use `requestAnimationFrame()` for smooth rendering
2. **Pixel Sampling**: Use ImageData array directly (avoid pixel-by-pixel getImageData calls)
3. **FFmpeg**: Offload encoding to Web Worker to prevent UI blocking
4. **Memory**: Release temporary canvases after processing
5. **File Size**: Optimize video compression without sacrificing quality

### Bottleneck Analysis
- **Image Processing**: ~100-500ms (depends on image size)
- **ASCII Conversion**: ~50-200ms (120×200 character grid)
- **Canvas Rendering**: ~50-100ms
- **Video Encoding**: 2-10 seconds (depends on duration and FFmpeg WASM performance)

---

## Error Handling

### Validation
- Check file type (image/* only)
- Validate image dimensions (min 100×100px)
- Verify browser supports Canvas API
- Ensure FFmpeg.wasm loads successfully

### User Feedback
- Display error messages in UI
- Disable inputs during processing
- Show cancel button during encoding
- Provide success/failure notifications

---

## Future Enhancements

### Phase 2
- [ ] Video file input support
- [ ] Animated frame generation (pulsing colors, character transitions)
- [ ] Custom character sets
- [ ] Configurable color palettes
- [ ] Aspect ratio selector (1:1, 9:16, 16:9, etc.)
- [ ] Frame rate control

### Phase 3
- [ ] Real-time preview on canvas
- [ ] Batch processing (multiple images)
- [ ] Audio track addition
- [ ] Text overlay on video
- [ ] Cloud rendering (for large files)
- [ ] Preset styles/filters

---

## Testing Checklist

- [ ] Single image upload → ASCII conversion
- [ ] Color accuracy in rendered output
- [ ] Video encoding completes without errors
- [ ] Video plays correctly in media player
- [ ] Download works across browsers
- [ ] Progress bar updates accurately
- [ ] Error handling for invalid files
- [ ] Responsive UI on mobile/tablet
- [ ] Performance acceptable for 1080x1920 resolution
