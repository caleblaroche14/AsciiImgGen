// ============================================================================
// GLOBAL STATE
// ============================================================================

let ffmpeg = null;
let ffmpegReady = false;
let FFmpegModule = null;
let currentImageData = null;
let currentAspectRatio = 1;
let isProcessing = false;
let animationLoop = null;
let currentMode = 'original';
let currentFont = 'Verdana';
let currentFPS = 5;
let currentCharWidth = 200;
let zoomMinChars = 10;
let zoomMaxChars = 300;
let customChars = '';

// Character mapping for brightness levels - array of arrays for variation
const CHARACTER_MAP = [
    [' ', '.', ','],                                    // 0-12.5%
    ['.', ',', "'", '`'],                              // 12.5-25%
    [':', ';', '`', '~'],                              // 25-37.5%
    ['-', '~', '_', '–'],                              // 37.5-50%
    ['=', '+', '^', '-', '~'],                          // 50-62.5%
    ['*', 'x', 'X', '+', 'o'],                          // 62.5-75%
    ['#', '@', '%', '&', 'W', 'M', 'O'],               // 75-87.5%
    ['#', '@', '%', '&', 'W', 'M', 'B', '$', 'D']      // 87.5-100% (darkest)
];

const CHAR_WIDTH = 200;
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const CHAR_REGION_SIZE = OUTPUT_WIDTH / CHAR_WIDTH; // ~5.4px per character

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeFFmpeg();
    setupEventListeners();
    loadDefaultImage();
});

/**
 * Initialize FFmpeg instance
 */
async function initializeFFmpeg() {
    // Wait for FFmpeg to be available globally
    if (typeof FFmpeg === 'undefined') {
        console.log('Waiting for FFmpeg.wasm to load...');
        return setTimeout(initializeFFmpeg, 100);
    }

    FFmpegModule = FFmpeg;
    const FFmpegClass = FFmpeg.FFmpeg;
    
    ffmpeg = new FFmpegClass();
    
    try {
        await ffmpeg.load();
        ffmpegReady = true;
        console.log('FFmpeg.wasm loaded successfully');
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        showStatus('Error: Failed to load FFmpeg. Please refresh the page.', 'error');
    }
}

/**
 * Setup event listeners for UI elements
 */
function setupEventListeners() {
    const imageInput = document.getElementById('imageInput');
    const generateButton = document.getElementById('generateButton');
    const downloadButton = document.getElementById('downloadButton');
    const cancelButton = document.getElementById('cancelButton');
    const modeSelect = document.getElementById('modeSelect');
    const fontSelect = document.getElementById('fontSelect');
    const resolutionSlider = document.getElementById('resolutionSlider');
    const fpsSlider = document.getElementById('fpsSlider');
    const zoomMinSlider = document.getElementById('zoomMinSlider');
    const zoomMaxSlider = document.getElementById('zoomMaxSlider');
    const customCharsInput = document.getElementById('customCharsInput');

    // File input handling
    imageInput.addEventListener('change', handleFileInput);

    // Drag and drop support
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', handleFileDrop);

    // Mode selection
    modeSelect.addEventListener('change', (e) => {
        currentMode = e.target.value;
        
        // Show/hide zoom sliders
        document.getElementById('zoomSettings').style.display = 
            currentMode === 'zoom' ? 'flex' : 'none';
        document.getElementById('zoomMaxSettings').style.display = 
            currentMode === 'zoom' ? 'flex' : 'none';
        
        if (currentImageData) {
            generatePreview();
        }
    });

    // Font selection
    fontSelect.addEventListener('change', (e) => {
        currentFont = e.target.value;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Resolution slider
    resolutionSlider.addEventListener('input', (e) => {
        currentCharWidth = parseInt(e.target.value);
        document.getElementById('resolutionValue').textContent = currentCharWidth;
        if (currentImageData) {
            generatePreview();
        }
    });

    // FPS slider
    fpsSlider.addEventListener('input', (e) => {
        currentFPS = parseInt(e.target.value);
        document.getElementById('fpsValue').textContent = currentFPS;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Zoom min slider
    zoomMinSlider.addEventListener('input', (e) => {
        zoomMinChars = parseInt(e.target.value);
        document.getElementById('zoomMinValue').textContent = zoomMinChars;
        if (currentImageData && currentMode === 'zoom') {
            generatePreview();
        }
    });

    // Zoom max slider
    zoomMaxSlider.addEventListener('input', (e) => {
        zoomMaxChars = parseInt(e.target.value);
        document.getElementById('zoomMaxValue').textContent = zoomMaxChars;
        if (currentImageData && currentMode === 'zoom') {
            generatePreview();
        }
    });

    // Custom characters input
    customCharsInput.addEventListener('input', (e) => {
        customChars = e.target.value;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Button handlers
    generateButton.addEventListener('click', generateVideo);
    downloadButton.addEventListener('click', downloadVideo);
    cancelButton.addEventListener('click', cancelProcessing);
}

/**
 * Load default image on page load
 */
async function loadDefaultImage() {
    try {
        const response = await fetch('images/tsr1_cover_v2.png');
        if (response.ok) {
            const blob = await response.blob();
            const img = new Image();
            img.onload = () => {
                loadImage(img);
                showStatus('Default image loaded successfully.', 'success');
            };
            img.onerror = () => {
                console.error('Failed to load image');
                showStatus('Failed to load default image', 'error');
            };
            img.src = URL.createObjectURL(blob);
        } else {
            console.warn('Image fetch failed with status:', response.status);
        }
    } catch (error) {
        console.error('Error loading default image:', error);
    }
}

// ============================================================================
// FILE INPUT HANDLING
// ============================================================================

/**
 * Handle file input from file selector
 */
function handleFileInput(event) {
    const file = event.target.files[0];
    if (file) {
        processImageFile(file);
    }
}

/**
 * Handle drag and drop file input
 */
function handleFileDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        processImageFile(files[0]);
    } else {
        showStatus('Please drop a valid image file', 'error');
    }
}

/**
 * Process uploaded image file
 */
function processImageFile(file) {
    if (!file.type.startsWith('image/')) {
        showStatus('Invalid file type. Please upload an image.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            loadImage(img);
        };
        img.onerror = () => {
            showStatus('Failed to load image. Please try another file.', 'error');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============================================================================
// IMAGE LOADING & PROCESSING
// ============================================================================

/**
 * Load image and prepare for ASCII conversion
 */
function loadImage(img) {
    const tempCanvas = document.getElementById('tempCanvas');
    const ctx = tempCanvas.getContext('2d');

    // Store aspect ratio for output scaling
    currentAspectRatio = img.width / img.height;

    // Set temporary canvas to image dimensions
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;

    // Draw image to canvas
    ctx.drawImage(img, 0, 0);

    // Get image data
    currentImageData = ctx.getImageData(0, 0, img.width, img.height);

    // Generate and display ASCII preview
    generatePreview();

    // Show action section
    document.getElementById('actionSection').style.display = 'block';
    document.getElementById('canvasPlaceholder').style.display = 'none';

    showStatus('Image loaded successfully. Click "Generate Video" to create ASCII art video.', 'success');
}

/**
 * Generate and display ASCII art preview on canvas
 */
function generatePreview() {
    if (!currentImageData) return;

    const outputCanvas = document.getElementById('outputCanvas');
    
    // Calculate dimensions based on aspect ratio
    const fontSize = calculateFontSize(OUTPUT_WIDTH, CHAR_WIDTH);
    const canvasHeight = Math.round(OUTPUT_WIDTH / currentAspectRatio);
    const charHeight = Math.round(canvasHeight / fontSize / 1.2);
    
    outputCanvas.width = OUTPUT_WIDTH;
    outputCanvas.height = canvasHeight;

    // For scroll mode, generate base frame once
    let baseASCIIFrame = null;
    if (currentMode === 'scroll') {
        baseASCIIFrame = convertFrameToASCII(currentImageData, currentCharWidth, charHeight);
    }

    // Start animation loop with fps based on mode
    if (animationLoop) clearInterval(animationLoop);
    let frameCount = 0;
    const frameInterval = 1000 / currentFPS;
    
    animationLoop = setInterval(() => {
        const ctx = outputCanvas.getContext('2d');

        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, OUTPUT_WIDTH, canvasHeight);

        // Get ASCII frame for this mode
        let asciiFrame = null;
        let renderCharHeight = charHeight;
        
        if (currentMode === 'original') {
            // Regenerate every frame for random characters
            asciiFrame = convertFrameToASCII(currentImageData, currentCharWidth, charHeight);
        } else if (currentMode === 'scroll') {
            asciiFrame = shiftASCIIFrame(baseASCIIFrame, frameCount % currentCharWidth);
        } else if (currentMode === 'zoom') {
            const progress = (frameCount % 30) / 30; // Cycle every 30 frames (3 seconds)
            const zoomCharWidth = getZoomCharWidth(progress);
            renderCharHeight = Math.round(zoomCharWidth / currentAspectRatio);
            asciiFrame = convertFrameToASCII(currentImageData, zoomCharWidth, renderCharHeight);
        }

        // Render ASCII to canvas
        renderASCIIFrame(asciiFrame, outputCanvas, fontSize, renderCharHeight);
        frameCount++;
    }, frameInterval);
}

// ============================================================================
// PIXEL SAMPLING & COLOR AVERAGING
// ============================================================================

/**
 * Sample and average pixel colors in a rectangular region
 */
function sampleRegion(imageData, startX, startY, width, height) {
    const data = imageData.data;
    const imgWidth = imageData.width;

    let sumR = 0, sumG = 0, sumB = 0;
    let pixelCount = 0;

    // Clamp to image bounds
    const endX = Math.min(startX + width, imgWidth);
    const endY = Math.min(startY + height, imageData.height);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const index = (y * imgWidth + x) * 4;
            sumR += data[index];
            sumG += data[index + 1];
            sumB += data[index + 2];
            pixelCount++;
        }
    }

    const avgR = Math.round(sumR / pixelCount);
    const avgG = Math.round(sumG / pixelCount);
    const avgB = Math.round(sumB / pixelCount);

    const brightness = calculateBrightness(avgR, avgG, avgB);

    return { r: avgR, g: avgG, b: avgB, brightness };
}

/**
 * Calculate perceived brightness using luminance formula (ITU-R BT.601)
 */
function calculateBrightness(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Map brightness value to ASCII character (randomly chosen from options)
 */
function pixelToCharacter(brightness) {
    // If custom characters provided, use them (ignore brightness)
    if (customChars && customChars.length > 0) {
        return customChars[Math.floor(Math.random() * customChars.length)];
    }
    
    // Default mode: use brightness-based mapping
    const index = Math.floor(brightness * CHARACTER_MAP.length);
    const charArray = CHARACTER_MAP[Math.min(index, CHARACTER_MAP.length - 1)];
    return charArray[Math.floor(Math.random() * charArray.length)];
}

/**
 * Shift ASCII frame horizontally (for scroll mode)
 */
function shiftASCIIFrame(asciiFrame, shiftAmount) {
    const shifted = {
        characters: [],
        colors: []
    };

    const charHeight = asciiFrame.characters.length;
    const charWidth = asciiFrame.characters[0].length;

    for (let y = 0; y < charHeight; y++) {
        shifted.characters[y] = [];
        shifted.colors[y] = [];

        for (let x = 0; x < charWidth; x++) {
            const sourceX = (x - shiftAmount + charWidth) % charWidth;
            shifted.characters[y][x] = asciiFrame.characters[y][sourceX];
            shifted.colors[y][x] = asciiFrame.colors[y][sourceX];
        }
    }

    return shifted;
}

/**
 * Calculate character width for zoom mode based on progress (0-1)
 * Interpolates between zoomMinChars and zoomMaxChars
 */
function getZoomCharWidth(progress) {
    // Create a wave: 0->1->0 over one cycle
    let wave = Math.sin(progress * Math.PI);
    return Math.round(zoomMinChars + (zoomMaxChars - zoomMinChars) * wave);
}

// ============================================================================
// ASCII CONVERSION
// ============================================================================

/**
 * Convert image region to ASCII art frame
 */
function convertFrameToASCII(imageData, charWidth, charHeight) {
    const imgWidth = imageData.width;
    const imgHeight = imageData.height;

    const characters = [];
    const colors = [];

    // Calculate pixel region size
    const regionWidth = imgWidth / charWidth;
    const regionHeight = imgHeight / charHeight;

    for (let charY = 0; charY < charHeight; charY++) {
        characters[charY] = [];
        colors[charY] = [];

        for (let charX = 0; charX < charWidth; charX++) {
            const pixelX = Math.floor(charX * regionWidth);
            const pixelY = Math.floor(charY * regionHeight);

            const sampled = sampleRegion(
                imageData,
                pixelX,
                pixelY,
                Math.ceil(regionWidth),
                Math.ceil(regionHeight)
            );

            characters[charY][charX] = pixelToCharacter(sampled.brightness);
            colors[charY][charX] = {
                r: sampled.r,
                g: sampled.g,
                b: sampled.b
            };
        }
    }

    return { characters, colors };
}

// ============================================================================
// CANVAS RENDERING
// ============================================================================

/**
 * Calculate font size to fit output canvas width
 */
function calculateFontSize(canvasWidth, charCount) {
    // Account for character width in monospace fonts (roughly 0.6x height)
    return Math.floor(canvasWidth / charCount / 0.6);
}

/**
 * Render ASCII frame to output canvas
 */
function renderASCIIFrame(asciiFrame, canvas, fontSize, charHeight) {
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set font
    ctx.font = `${fontSize}px ${currentFont}`;
    ctx.textBaseline = 'top';

    const charWidth = asciiFrame.characters[0].length;
    const charPixelWidth = canvas.width / charWidth;
    const charPixelHeight = canvas.height / charHeight;

    // Draw each character
    for (let y = 0; y < charHeight; y++) {
        for (let x = 0; x < charWidth; x++) {
            const char = asciiFrame.characters[y][x];
            const color = asciiFrame.colors[y][x];

            const pixelX = x * charPixelWidth;
            const pixelY = y * charPixelHeight;

            // Set color
            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;

            // Draw character
            ctx.fillText(char, pixelX, pixelY);
        }
    }
}

/**
 * Draw single character at position with color (utility function)
 */
function drawCharacter(ctx, char, x, y, fontSize, color) {
    ctx.font = `${fontSize}px 'Courier New', monospace`;
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.fillText(char, x, y);
}

// ============================================================================
// VIDEO GENERATION
// ============================================================================

/**
 * Generate video from current image
 */
async function generateVideo() {
    if (!currentImageData || !ffmpegReady) {
        showStatus('Please upload an image first or wait for FFmpeg to load.', 'error');
        return;
    }

    if (isProcessing) return;

    isProcessing = true;
    const progressSection = document.getElementById('progressSection');
    const actionSection = document.getElementById('actionSection');

    // Show progress section, hide action section
    progressSection.style.display = 'block';
    actionSection.style.display = 'none';
    document.getElementById('generateButton').disabled = true;

    try {
        const duration = parseInt(document.getElementById('durationInput').value) || 5;
        const framerate = 30;
        const totalFrames = duration * framerate;

        updateProgress(0);

        // Stop animation loop
        if (animationLoop) clearInterval(animationLoop);

        // Generate ASCII frame once
        const fontSize = calculateFontSize(OUTPUT_WIDTH, CHAR_WIDTH);

        // Calculate video dimensions based on aspect ratio
        const videoWidth = OUTPUT_WIDTH;
        const videoHeight = Math.round(videoWidth / currentAspectRatio);
        
        // Calculate character grid height based on rendered height
        const charHeight = Math.round(videoHeight / fontSize / 1.2);
        
        const baseASCIIFrame = convertFrameToASCII(currentImageData, currentCharWidth, charHeight);
        
        const videoCanvas = document.createElement('canvas');
        videoCanvas.width = videoWidth;
        videoCanvas.height = videoHeight;

        // Create frame array with mode-specific logic
        const frames = [];
        let cachedASCIIFrame = null;
        let lastASCIIFrameIndex = -1;
        
        for (let i = 0; i < totalFrames; i++) {
            // Get ASCII frame for this mode
            let asciiFrame = null;
            let renderCharHeight = charHeight;
            
            if (currentMode === 'original') {
                // Regenerate ASCII frame every 3 frames (10fps @ 30fps video)
                if (i % 3 === 0) {
                    asciiFrame = convertFrameToASCII(currentImageData, currentCharWidth, charHeight);
                    cachedASCIIFrame = asciiFrame;
                } else {
                    asciiFrame = cachedASCIIFrame;
                }
            } else if (currentMode === 'scroll') {
                asciiFrame = shiftASCIIFrame(baseASCIIFrame, i % currentCharWidth);
            } else if (currentMode === 'zoom') {
                // Cycle through zoom multiple times over video duration
                const cycleLength = Math.floor(totalFrames / 3); // 3 zoom cycles per video
                const progress = (i % cycleLength) / cycleLength;
                const zoomCharWidth = getZoomCharWidth(progress);
                renderCharHeight = Math.round(zoomCharWidth / currentAspectRatio);
                asciiFrame = convertFrameToASCII(currentImageData, zoomCharWidth, renderCharHeight);
            }

            // Render frame to temporary canvas
            const tempVideoCanvas = document.createElement('canvas');
            tempVideoCanvas.width = videoWidth;
            tempVideoCanvas.height = videoHeight;
            
            const ctx = tempVideoCanvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, videoWidth, videoHeight);
            renderASCIIFrame(asciiFrame, tempVideoCanvas, fontSize, renderCharHeight);

            frames.push(ctx.getImageData(0, 0, videoWidth, videoHeight));
            updateProgress(Math.round((i / totalFrames) * 30)); // 0-30% for frame generation
        }

        // Encode to MP4
        const videoBlob = await encodeToMP4(frames, duration, (percent) => {
            updateProgress(30 + Math.round(percent * 0.7)); // 30-100% for encoding
        });

        // Save video for download
        window.generatedVideoBlob = videoBlob;

        updateProgress(100);
        showStatus('Video generated successfully! Click "Download Video" to save.', 'success');

        // Show download button
        document.getElementById('downloadButton').style.display = 'inline-block';

    } catch (error) {
        console.error('Error generating video:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
        progressSection.style.display = 'none';
        actionSection.style.display = 'block';
        document.getElementById('generateButton').disabled = false;
        
        // Restart animation loop
        if (currentImageData) {
            generatePreview();
        }
    }
}

/**
 * Encode frames to MP4 video using FFmpeg
 */
async function encodeToMP4(frames, duration, onProgress) {
    if (!ffmpegReady) {
        throw new Error('FFmpeg not ready');
    }

    const framerate = 30;
    const totalFrames = frames.length;

    // Write frames to FFmpeg as raw video
    for (let i = 0; i < totalFrames; i++) {
        const frameData = frames[i].data;
        const fileName = `frame_${String(i).padStart(6, '0')}.ppm`;

        // Create PPM format (simple uncompressed image format)
        const ppmHeader = `P6\n${OUTPUT_WIDTH} ${OUTPUT_HEIGHT}\n255\n`;
        const headerBytes = new TextEncoder().encode(ppmHeader);

        // Extract RGB from RGBA
        const rgbData = new Uint8Array(OUTPUT_WIDTH * OUTPUT_HEIGHT * 3);
        for (let j = 0; j < frameData.length; j += 4) {
            const rgbIndex = (j / 4) * 3;
            rgbData[rgbIndex] = frameData[j];         // R
            rgbData[rgbIndex + 1] = frameData[j + 1]; // G
            rgbData[rgbIndex + 2] = frameData[j + 2]; // B
        }

        // Combine header and RGB data
        const fileData = new Uint8Array(headerBytes.length + rgbData.length);
        fileData.set(headerBytes);
        fileData.set(rgbData, headerBytes.length);

        await ffmpeg.writeFile(fileName, fileData);

        if (onProgress) {
            onProgress((i / totalFrames) * 100);
        }
    }

    // Run FFmpeg to create video
    await ffmpeg.exec([
        '-framerate', String(framerate),
        '-pattern_type', 'glob',
        '-i', 'frame_*.ppm',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '23',
        'output.mp4'
    ]);

    // Read output video file
    const videoData = await ffmpeg.readFile('output.mp4');
    const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });

    // Clean up FFmpeg filesystem
    await ffmpeg.deleteFile('output.mp4');
    for (let i = 0; i < totalFrames; i++) {
        const fileName = `frame_${String(i).padStart(6, '0')}.ppm`;
        try {
            await ffmpeg.deleteFile(fileName);
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    return videoBlob;
}

// ============================================================================
// UI UTILITIES
// ============================================================================

/**
 * Update progress bar and text
 */
function updateProgress(percent) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message status-${type}`;

    if (type !== 'error') {
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status-message';
        }, 5000);
    }
}

/**
 * Download generated video
 */
function downloadVideo() {
    if (!window.generatedVideoBlob) {
        showStatus('No video to download. Generate a video first.', 'error');
        return;
    }

    const url = URL.createObjectURL(window.generatedVideoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ascii-art-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('Video downloaded successfully!', 'success');
}

/**
 * Cancel video generation (placeholder for future implementation)
 */
function cancelProcessing() {
    isProcessing = false;
    const progressSection = document.getElementById('progressSection');
    const actionSection = document.getElementById('actionSection');

    progressSection.style.display = 'none';
    actionSection.style.display = 'block';

    showStatus('Video generation cancelled.', 'info');
}
