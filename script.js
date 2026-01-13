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
let currentInputType = 'image'; // 'image' or 'video'
let currentVideoPath = null;
let currentMode = 'original';
let currentFont = 'Verdana';
let currentFPS = 5;
let currentCharWidth = 200;
let zoomMinChars = 10;
let zoomMaxChars = 300;
let customChars = '';
let flagDistance = 20;
let flagSpeed = 1;
let ditherSensitivity = 0.3;
let ditherContrast = 1;
let glitchIntensity = 3;
let vignette = 0;
let brightness = 0;
let contrast = 100;
let saturation = 100;
let hue = 0;
let grayscale = 0;
let invert = 0;
let blur = 0;
let sepia = 0;
let opacity = 100;
let glow = 0;
let brightnessBoost = 0;
let warmth = 0;
let shadow = 0;
let ffmpegRetryCount = 0;
let currentVideoElement = null; // Store reference to playing video element
let currentLoadedType = 'image'; // Track whether 'image' or 'video' is currently loaded

// Image Overlay variables
let overlayImageData = null;
let overlayEnabled = false;
let overlayX = 50; // percentage
let overlayY = 50; // percentage
let overlaySize = 550; // pixels
let overlayOpacity = 100; // percentage
let overlayBlur = 0; // pixels
let overlayGlow = 0; // intensity
let overlayShadow = 0; // intensity
let overlaySaturation = 100; // percentage
let overlayBrightness = 0; // -100 to 100
let overlayContrast = 100; // percentage
let overlayRotation = 0; // degrees
let isDraggingOverlay = false;
let dragStartX = 0;
let dragStartY = 0;

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

// Bayer matrix for ordered dithering (4x4 pattern)
const BAYER_MATRIX_4x4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
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
    try {
        // Wait for FFmpeg to be available in global scope
        if (typeof FFmpeg === 'undefined') {
            return setTimeout(initializeFFmpeg, 100);
        }

        const FFmpegClass = FFmpeg.FFmpeg;
        if (!FFmpegClass && FFmpeg.createFFmpeg) {
            // Older API: use createFFmpeg
            ffmpeg = FFmpeg.createFFmpeg({ log: false });
            ffmpeg._oldAPI = true;
        } else if (FFmpegClass) {
            // Newer API: use FFmpeg class
            ffmpeg = new FFmpegClass();
            ffmpeg._oldAPI = false;
        } else {
            return setTimeout(initializeFFmpeg, 100);
        }
        
        FFmpegModule = FFmpeg;
        
        await ffmpeg.load();
        ffmpegReady = true;
        
        // Log available methods for debugging
        console.log('FFmpeg loaded. API type:', ffmpeg._oldAPI ? 'old (createFFmpeg)' : 'new (FFmpeg class)');
        console.log('FFmpeg methods:', Object.keys(ffmpeg));
        if (ffmpeg.FS) {
            console.log('FS methods:', Object.keys(ffmpeg.FS));
        }
    } catch (error) {
        const errorMsg = error.message || String(error);
        
        // SharedArrayBuffer error requires special server setup - just continue without video generation
        if (errorMsg.includes('SharedArrayBuffer')) {
            return; // Don't retry or show error, just continue
        }
        
        ffmpegRetryCount++;
        if (ffmpegRetryCount >= MAX_FFMPEG_RETRIES) {
            console.error('FFmpeg failed to load after', MAX_FFMPEG_RETRIES, 'attempts');
            showStatus('Error: FFmpeg failed to load. Please try refreshing the page.', 'error');
            return;
        }
        

        return setTimeout(initializeFFmpeg, 1000);
    }
}

/**
 * Setup event listeners for UI elements
 */
function setupEventListeners() {
    // Setup overlay panel toggles
    setupOverlayPanels();

    const imageInput = document.getElementById('imageInput');
    const videoInput = document.getElementById('videoInput');
    const generateButton = document.getElementById('generateButton');
    const downloadButton = document.getElementById('downloadButton');
    const cancelButton = document.getElementById('cancelButton');
    const modeSelect = document.getElementById('modeSelect');
    const fontSelect = document.getElementById('fontSelect');
    const resolutionSlider = document.getElementById('resolutionSlider');
    const fpsSlider = document.getElementById('fpsSlider');
    const zoomMinSlider = document.getElementById('zoomMinSlider');
    const zoomMaxSlider = document.getElementById('zoomMaxSlider');
    const flagDistanceSlider = document.getElementById('flagDistanceSlider');
    const flagSpeedSlider = document.getElementById('flagSpeedSlider');
    const ditherSensitivitySlider = document.getElementById('ditherSensitivitySlider');
    const ditherContrastSlider = document.getElementById('ditherContrastSlider');
    const glitchIntensitySlider = document.getElementById('glitchIntensitySlider');
    const vignetteSlider = document.getElementById('vignetteSlider');
    const brightnessSlider = document.getElementById('brightnessSlider');
    const contrastSlider = document.getElementById('contrastSlider');
    const saturationSlider = document.getElementById('saturationSlider');
    const hueSlider = document.getElementById('hueSlider');
    const grayscaleSlider = document.getElementById('grayscaleSlider');
    const invertSlider = document.getElementById('invertSlider');
    const blurSlider = document.getElementById('blurSlider');
    const sepiaSlider = document.getElementById('sepiaSlider');
    const opacitySlider = document.getElementById('opacitySlider');
    const glowSlider = document.getElementById('glowSlider');
    const brightnessBoostSlider = document.getElementById('brightnessBoostSlider');
    const warmthSlider = document.getElementById('warmthSlider');
    const shadowSlider = document.getElementById('shadowSlider');
    const customCharsInput = document.getElementById('customCharsInput');

    // File input handling
    imageInput.addEventListener('change', handleImageInput);
    videoInput.addEventListener('change', handleVideoInput);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchInputTab(tab);
        });
    });

    // Drag and drop support
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', handleFileDrop);

    // Mode selection
    modeSelect.addEventListener('change', (e) => {
        currentMode = e.target.value;
        updateModeSettings(currentMode);
        
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

    // Flag distance slider
    flagDistanceSlider.addEventListener('input', (e) => {
        flagDistance = parseInt(e.target.value);
        document.getElementById('flagDistanceValue').textContent = flagDistance;
        if (currentImageData && currentMode === 'flag') {
            generatePreview();
        }
    });

    // Flag speed slider
    flagSpeedSlider.addEventListener('input', (e) => {
        flagSpeed = parseInt(e.target.value);
        document.getElementById('flagSpeedValue').textContent = flagSpeed;
        if (currentImageData && currentMode === 'flag') {
            generatePreview();
        }
    });

    // Dither sensitivity slider
    ditherSensitivitySlider.addEventListener('input', (e) => {
        ditherSensitivity = parseFloat(e.target.value);
        document.getElementById('ditherSensitivityValue').textContent = ditherSensitivity.toFixed(2);
        if (currentImageData && currentMode === 'dither') {
            generatePreview();
        }
    });

    // Dither contrast slider
    ditherContrastSlider.addEventListener('input', (e) => {
        ditherContrast = parseFloat(e.target.value);
        document.getElementById('ditherContrastValue').textContent = ditherContrast.toFixed(1);
        if (currentImageData && currentMode === 'dither') {
            generatePreview();
        }
    });

    // Glitch intensity slider
    glitchIntensitySlider.addEventListener('input', (e) => {
        glitchIntensity = parseInt(e.target.value);
        document.getElementById('glitchIntensityValue').textContent = glitchIntensity;
        if (currentImageData && currentMode === 'glitch') {
            generatePreview();
        }
    });

    // Vignette effect
    vignetteSlider.addEventListener('input', (e) => {
        vignette = parseFloat(e.target.value);
        document.getElementById('vignetteValue').textContent = vignette.toFixed(2);
        if (currentImageData) {
            generatePreview();
        }
    });

    // Brightness effect
    brightnessSlider.addEventListener('input', (e) => {
        brightness = parseInt(e.target.value);
        document.getElementById('brightnessValue').textContent = brightness;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Contrast effect
    contrastSlider.addEventListener('input', (e) => {
        contrast = parseInt(e.target.value);
        document.getElementById('contrastValue').textContent = contrast;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Saturation effect
    saturationSlider.addEventListener('input', (e) => {
        saturation = parseInt(e.target.value);
        document.getElementById('saturationValue').textContent = saturation;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Hue shift effect
    hueSlider.addEventListener('input', (e) => {
        hue = parseInt(e.target.value);
        document.getElementById('hueValue').textContent = hue;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Grayscale effect
    grayscaleSlider.addEventListener('input', (e) => {
        grayscale = parseInt(e.target.value);
        document.getElementById('grayscaleValue').textContent = grayscale;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Invert effect
    invertSlider.addEventListener('input', (e) => {
        invert = parseInt(e.target.value);
        document.getElementById('invertValue').textContent = invert;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Blur effect
    blurSlider.addEventListener('input', (e) => {
        blur = parseFloat(e.target.value);
        document.getElementById('blurValue').textContent = blur.toFixed(1);
        if (currentImageData) {
            generatePreview();
        }
    });

    // Sepia effect
    sepiaSlider.addEventListener('input', (e) => {
        sepia = parseInt(e.target.value);
        document.getElementById('sepiaValue').textContent = sepia;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Opacity effect
    opacitySlider.addEventListener('input', (e) => {
        opacity = parseInt(e.target.value);
        document.getElementById('opacityValue').textContent = opacity;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Glow effect
    glowSlider.addEventListener('input', (e) => {
        glow = parseFloat(e.target.value);
        document.getElementById('glowValue').textContent = glow.toFixed(1);
        if (currentImageData) {
            generatePreview();
        }
    });

    // Brightness boost effect
    brightnessBoostSlider.addEventListener('input', (e) => {
        brightnessBoost = parseInt(e.target.value);
        document.getElementById('brightnessBoostValue').textContent = brightnessBoost;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Warmth effect
    warmthSlider.addEventListener('input', (e) => {
        warmth = parseInt(e.target.value);
        document.getElementById('warmthValue').textContent = warmth;
        if (currentImageData) {
            generatePreview();
        }
    });

    // Shadow effect
    shadowSlider.addEventListener('input', (e) => {
        shadow = parseFloat(e.target.value);
        document.getElementById('shadowValue').textContent = shadow.toFixed(1);
        if (currentImageData) {
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

    // Overlay image upload
    const overlayImageInput = document.getElementById('overlayImageInput');
    overlayImageInput.addEventListener('change', handleOverlayImageInput);

    // Overlay enabled toggle
    const overlayEnabledToggle = document.getElementById('overlayEnabledToggle');
    overlayEnabledToggle.addEventListener('change', (e) => {
        overlayEnabled = e.target.checked;
        document.getElementById('overlayPositioningControls').style.display = overlayEnabled ? 'grid' : 'none';
        document.getElementById('overlayEffectsControls').style.display = overlayEnabled ? 'grid' : 'none';
        
        const overlayImage = document.getElementById('overlayImage');
        if (overlayEnabled && overlayImageData) {
            overlayImage.style.display = 'block';
            updateOverlayPosition();
            updateOverlayStyles();
        } else {
            overlayImage.style.display = 'none';
        }
        
        if (currentImageData) {
            generatePreview();
        }
    });

    // Overlay positioning and sizing sliders
    document.getElementById('overlayXSlider').addEventListener('input', (e) => {
        overlayX = parseInt(e.target.value);
        document.getElementById('overlayXValue').textContent = overlayX;
        updateOverlayPosition();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlayYSlider').addEventListener('input', (e) => {
        overlayY = parseInt(e.target.value);
        document.getElementById('overlayYValue').textContent = overlayY;
        updateOverlayPosition();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlaySizeSlider').addEventListener('input', (e) => {
        overlaySize = parseInt(e.target.value);
        document.getElementById('overlaySizeValue').textContent = overlaySize;
        updateOverlayPosition();
        if (currentImageData) {
            generatePreview();
        }
    });

    // Overlay effects sliders
    document.getElementById('overlayOpacitySlider').addEventListener('input', (e) => {
        overlayOpacity = parseInt(e.target.value);
        document.getElementById('overlayOpacityValue').textContent = overlayOpacity;
        updateOverlayStyles();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlayBlurSlider').addEventListener('input', (e) => {
        overlayBlur = parseFloat(e.target.value);
        document.getElementById('overlayBlurValue').textContent = overlayBlur.toFixed(1);
        updateOverlayStyles();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlayGlowSlider').addEventListener('input', (e) => {
        overlayGlow = parseFloat(e.target.value);
        document.getElementById('overlayGlowValue').textContent = overlayGlow.toFixed(1);
        updateOverlayStyles();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlayShadowSlider').addEventListener('input', (e) => {
        overlayShadow = parseFloat(e.target.value);
        document.getElementById('overlayShadowValue').textContent = overlayShadow.toFixed(1);
        updateOverlayStyles();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlaySaturationSlider').addEventListener('input', (e) => {
        overlaySaturation = parseInt(e.target.value);
        document.getElementById('overlaySaturationValue').textContent = overlaySaturation;
        updateOverlayStyles();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlayBrightnessSlider').addEventListener('input', (e) => {
        overlayBrightness = parseInt(e.target.value);
        document.getElementById('overlayBrightnessValue').textContent = overlayBrightness;
        updateOverlayStyles();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlayContrastSlider').addEventListener('input', (e) => {
        overlayContrast = parseInt(e.target.value);
        document.getElementById('overlayContrastValue').textContent = overlayContrast;
        updateOverlayStyles();
        if (currentImageData) {
            generatePreview();
        }
    });

    document.getElementById('overlayRotationSlider').addEventListener('input', (e) => {
        overlayRotation = parseInt(e.target.value);
        document.getElementById('overlayRotationValue').textContent = overlayRotation;
        updateOverlayPosition();
        if (currentImageData) {
            generatePreview();
        }
    });

    // Overlay image drag and drop support
    const overlayImage = document.getElementById('overlayImage');
    overlayImage.addEventListener('mousedown', startDraggingOverlay);
    document.addEventListener('mousemove', dragOverlay);
    document.addEventListener('mouseup', stopDraggingOverlay);

    // Button handlers
    generateButton.addEventListener('click', generateVideo);
    downloadButton.addEventListener('click', downloadVideo);
    cancelButton.addEventListener('click', cancelProcessing);
}

/**
 * Setup overlay panel toggle functionality
 */
function setupOverlayPanels() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarMenu = document.getElementById('sidebarMenu');
    const menuItems = document.querySelectorAll('.sidebar-menu-item');
    let panelsOpen = false;
    let menuOpen = false;
    
    // Sidebar toggle functionality
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Toggle menu visibility on mobile
            menuOpen = !menuOpen;
            if (sidebarMenu) {
                sidebarMenu.classList.toggle('open');
            }
            
            // Also toggle panels
            panelsOpen = !panelsOpen;
            sidebarToggle.classList.toggle('open');
            
            if (!panelsOpen) {
                // Close all panels
                const allPanels = document.querySelectorAll('.overlay-panel');
                allPanels.forEach(panel => {
                    panel.classList.add('hidden');
                });
                if (sidebarMenu) {
                    sidebarMenu.classList.remove('open');
                }
            }
        });
    }
    
    // Sidebar menu item functionality
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const panelId = item.dataset.overlay;
            const panel = document.getElementById(panelId);
            
            if (panel) {
                panel.classList.toggle('hidden');
                
                // Update sidebar state based on whether any panels are open
                const allPanels = document.querySelectorAll('.overlay-panel');
                const anyOpen = Array.from(allPanels).some(p => !p.classList.contains('hidden'));
                panelsOpen = anyOpen;
                
                if (sidebarToggle) {
                    if (anyOpen) {
                        sidebarToggle.classList.add('open');
                    } else {
                        sidebarToggle.classList.remove('open');
                        if (sidebarMenu) {
                            sidebarMenu.classList.remove('open');
                        }
                        menuOpen = false;
                    }
                }
            }
        });
    });

    // Close panels when clicking the X button (on the h3 element)
    const panels = document.querySelectorAll('.overlay-panel');
    panels.forEach(panel => {
        const h3 = panel.querySelector('h3');
        if (h3) {
            // Create a close button element
            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.padding = '5px 10px';
            closeBtn.style.fontSize = '1.2rem';
            closeBtn.style.transition = 'all 0.2s ease';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.add('hidden');
                
                // Update sidebar state
                const allPanels = document.querySelectorAll('.overlay-panel');
                const anyOpen = Array.from(allPanels).some(p => !p.classList.contains('hidden'));
                panelsOpen = anyOpen;
                
                if (sidebarToggle) {
                    if (anyOpen) {
                        sidebarToggle.classList.add('open');
                    } else {
                        sidebarToggle.classList.remove('open');
                        if (sidebarMenu) {
                            sidebarMenu.classList.remove('open');
                        }
                        menuOpen = false;
                    }
                }
            });
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.transform = 'scale(1.2)';
                closeBtn.style.color = '#ff6b6b';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.transform = 'scale(1)';
                closeBtn.style.color = '#00d4ff';
            });
            h3.appendChild(closeBtn);
        }
    });

    // Hide panels by default
    panels.forEach(panel => {
        panel.classList.add('hidden');
    });
    
    // Close menu when clicking outside on mobile
    document.addEventListener('click', () => {
        if (menuOpen && sidebarMenu && !sidebarToggle.contains(event.target)) {
            sidebarMenu.classList.remove('open');
            menuOpen = false;
        }
    });
}

/**
 * Update visibility of mode-specific settings
 */
function updateModeSettings(mode) {
    // Helper function to set display with !important
    const setDisplay = (elementId, shouldShow) => {
        const el = document.getElementById(elementId);
        if (el) {
            el.style.setProperty('display', shouldShow ? 'flex' : 'none', 'important');
        }
    };
    
    // Show/hide zoom sliders
    setDisplay('zoomSettings', mode === 'zoom');
    setDisplay('zoomMaxSettings', mode === 'zoom');
    
    // Show/hide flag sliders
    setDisplay('flagDistanceSettings', mode === 'flag');
    setDisplay('flagSpeedSettings', mode === 'flag');
    
    // Show/hide dither slider
    setDisplay('ditherSensitivitySettings', mode === 'dither');
    setDisplay('ditherContrastSettings', mode === 'dither');
    
    // Show/hide glitch slider
    setDisplay('glitchIntensitySettings', mode === 'glitch');
}

/**
 * Load default image on page load
 */
async function loadDefaultImage() {
    // Fallback to image if video not found
    try {
        const response = await fetch('images/tsr1_cover_v2.png');
        if (response.ok) {
            const blob = await response.blob();
            const img = new Image();
            img.onload = () => {
                loadImage(img);
                currentLoadedType = 'image';
                showStatus('Default image loaded successfully.', 'success');
                // Load default overlay
                loadDefaultOverlay();
                // Initialize mode settings visibility
                updateModeSettings(currentMode);
            };
            img.onerror = () => {
                showStatus('Failed to load default image', 'error');
            };
            img.src = URL.createObjectURL(blob);
        }
    } catch (error) {
    }
}

/**
 * Load default overlay image
 */
async function loadDefaultOverlay() {
    try {
        const response = await fetch('images/tsr1_cover_v2.png');
        if (response.ok) {
            const blob = await response.blob();
            const img = new Image();
            img.onload = () => {
                overlayImageData = img;
                
                // Enable overlay
                const overlayEnabledToggle = document.getElementById('overlayEnabledToggle');
                overlayEnabledToggle.checked = true;
                overlayEnabled = true;
                document.getElementById('overlayPositioningControls').style.display = 'grid';
                document.getElementById('overlayEffectsControls').style.display = 'grid';
                
                // Display overlay image
                const overlayImage = document.getElementById('overlayImage');
                overlayImage.src = img.src;
                overlayImage.style.display = 'block';
                updateOverlayPosition();
                updateOverlayStyles();
                
                if (currentImageData) {
                    generatePreview();
                }
            };
            img.src = URL.createObjectURL(blob);
        }
    } catch (error) {
        // Silently fail if default overlay doesn't exist
    }
}

/**
 * Load default video for preview
 */
async function loadDefaultVideo() {
    try {
        const response = await fetch('images/testvid.mp4');
        
        if (response.ok) {
            const blob = await response.blob();
            
            // Create a mock file-like object with type property
            const videoFile = new File([blob], 'testvid.mp4', { type: 'video/mp4' });
            
            // Read blob as data URL and process
            const reader = new FileReader();
            reader.onload = (e) => {
                const videoPath = e.target.result;
                currentVideoPath = videoPath;
                currentInputType = 'video';
                
                // Create video element to extract metadata and first frame
                const video = document.createElement('video');
                video.crossOrigin = 'anonymous';
                
                video.onloadedmetadata = () => {
                    currentAspectRatio = video.videoWidth / video.videoHeight;
                };
                
                video.oncanplay = () => {
                    currentAspectRatio = video.videoWidth / video.videoHeight;
                    currentVideoElement = video;
                    currentLoadedType = 'video';
                    
                    // Enable looping
                    video.loop = true;
                    
                    // Start real-time video preview
                    generateVideoPreview(video);
                    
                    document.getElementById('actionSection').style.display = 'block';
                    document.getElementById('canvasPlaceholder').style.display = 'none';
                    
                    showStatus('Default video loaded successfully. Video is now playing.', 'success');
                };
                
                video.onerror = (e) => {
                    console.error('Video error event:', e);
                    showStatus('Error loading video.', 'error');
                };
                
                video.src = videoPath;
                video.play().catch(() => {});
            };
            reader.onerror = () => {
                showStatus('Error reading video file.', 'error');
            };
            reader.readAsDataURL(videoFile);
        } else {
            showStatus('Failed to load default video.', 'error');
        }
    } catch (error) {
        showStatus('Error loading default video.', 'error');
    }
}

// ============================================================================
// FILE INPUT HANDLING
// ============================================================================

/**
 * Switch input tabs between image and video
 */
function switchInputTab(tab) {
    currentInputType = tab;
    
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Show/hide tab content
    document.querySelectorAll('[data-tab-content]').forEach(el => {
        el.style.display = el.dataset.tabContent === tab ? 'block' : 'none';
    });
    
    // Stop video if switching away from video tab
    if (tab !== 'video' && currentVideoElement) {
        currentVideoElement.pause();
        currentVideoElement.currentTime = 0;
    }
    
    // Clear any running animation loops
    if (animationLoop) {
        if (typeof animationLoop === 'number') {
            clearInterval(animationLoop); // for setInterval loops
            cancelAnimationFrame(animationLoop); // also try cancelAnimationFrame
        } else {
            cancelAnimationFrame(animationLoop); // for requestAnimationFrame loops
        }
        animationLoop = null;
    }
    
    // Load default content for the tab if nothing of this type is loaded yet
    if (tab === 'video' && currentLoadedType !== 'video') {
        loadDefaultVideo();
    } else if (tab === 'image') {
        if (currentLoadedType !== 'image') {
            loadDefaultImage();
        } else if (currentImageData) {
            // If image is already loaded, regenerate the preview and show UI elements
            document.getElementById('actionSection').style.display = 'block';
            document.getElementById('canvasPlaceholder').style.display = 'none';
            document.getElementById('outputCanvas').style.display = 'block';
            generatePreview();
        }
    }
}

/**
 * Handle image file input from file selector
 */
function handleImageInput(event) {
    const file = event.target.files[0];
    if (file) {
        processImageFile(file);
    }
}

/**
 * Handle video file input from file selector
 */
function handleVideoInput(event) {
    const file = event.target.files[0];
    if (file) {
        processVideoFile(file);
    }
}

/**
 * Handle drag and drop file input
 */
function handleFileDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length === 0) return;
    
    const file = files[0];
    if (file.type.startsWith('image/')) {
        switchInputTab('image');
        processImageFile(file);
    } else if (file.type.startsWith('video/')) {
        switchInputTab('video');
        processVideoFile(file);
    } else {
        showStatus('Please drop a valid image or video file', 'error');
    }
}

/**
 * Handle overlay image input from file selector
 */
function handleOverlayImageInput(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                overlayImageData = img;
                showStatus('Overlay image loaded successfully', 'success');
                
                // Enable overlay if image loaded
                if (!overlayEnabled) {
                    document.getElementById('overlayEnabledToggle').checked = true;
                    overlayEnabled = true;
                    document.getElementById('overlayPositioningControls').style.display = 'grid';
                    document.getElementById('overlayEffectsControls').style.display = 'grid';
                }
                
                // Display overlay image
                const overlayImage = document.getElementById('overlayImage');
                overlayImage.src = img.src;
                overlayImage.style.display = 'block';
                updateOverlayPosition();
                updateOverlayStyles();
                
                if (currentImageData) {
                    generatePreview();
                }
            };
            img.onerror = () => {
                showStatus('Failed to load overlay image', 'error');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Update overlay image position and size
 */
function updateOverlayPosition() {
    const overlayImage = document.getElementById('overlayImage');
    const canvasContainer = document.getElementById('canvasContainer');
    
    if (!overlayImage || !canvasContainer) return;
    
    const containerRect = canvasContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Calculate position based on percentage
    const x = (containerWidth * overlayX) / 100 - (overlaySize / 2);
    const y = (containerHeight * overlayY) / 100 - (overlaySize / 2);
    
    overlayImage.style.left = x + 'px';
    overlayImage.style.top = y + 'px';
    overlayImage.style.width = overlaySize + 'px';
    overlayImage.style.height = overlaySize + 'px';
    overlayImage.style.transform = `rotate(${overlayRotation}deg)`;
}

/**
 * Update overlay image styles (effects)
 */
function updateOverlayStyles() {
    const overlayImage = document.getElementById('overlayImage');
    if (!overlayImage) return;
    
    // Build filter string
    let filters = [];
    
    if (overlayBlur > 0) {
        filters.push(`blur(${overlayBlur}px)`);
    }
    
    if (overlayBrightness !== 0) {
        filters.push(`brightness(${100 + overlayBrightness}%)`);
    }
    
    if (overlayContrast !== 100) {
        filters.push(`contrast(${overlayContrast}%)`);
    }
    
    if (overlaySaturation !== 100) {
        filters.push(`saturate(${overlaySaturation}%)`);
    }
    
    // Apply filters
    if (filters.length > 0) {
        overlayImage.style.filter = filters.join(' ');
    } else {
        overlayImage.style.filter = 'none';
    }
    
    // Apply opacity
    overlayImage.style.opacity = overlayOpacity / 100;
    
    // Apply glow effect using box-shadow
    if (overlayGlow > 0) {
        const glowColor = `rgba(0, 212, 255, ${0.3 + (overlayGlow * 0.05)})`;
        const glowSize = Math.ceil(overlayGlow * 2);
        overlayImage.style.boxShadow = `0 0 ${glowSize}px ${glowColor}, inset 0 0 ${glowSize}px ${glowColor}`;
    } else {
        overlayImage.style.boxShadow = 'none';
    }
    
    // Apply shadow effect
    if (overlayShadow > 0) {
        const shadowSize = Math.ceil(overlayShadow);
        overlayImage.style.boxShadow = `${shadowSize}px ${shadowSize}px ${shadowSize * 2}px rgba(0, 0, 0, ${0.3 + (overlayShadow * 0.03)})`;
    }
}

/**
 * Start dragging overlay image
 */
function startDraggingOverlay(e) {
    if (!overlayEnabled || !overlayImageData) return;
    
    isDraggingOverlay = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    const overlayImage = document.getElementById('overlayImage');
    overlayImage.classList.add('dragging');
}

/**
 * Drag overlay image
 */
function dragOverlay(e) {
    if (!isDraggingOverlay) return;
    
    const overlayImage = document.getElementById('overlayImage');
    const canvasContainer = document.getElementById('canvasContainer');
    
    if (!overlayImage || !canvasContainer) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    const containerRect = canvasContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Calculate new position
    let currentX = (overlayX * containerWidth) / 100 - (overlaySize / 2);
    let currentY = (overlayY * containerHeight) / 100 - (overlaySize / 2);
    
    currentX += deltaX;
    currentY += deltaY;
    
    // Constrain within bounds
    currentX = Math.max(0, Math.min(currentX, containerWidth - overlaySize));
    currentY = Math.max(0, Math.min(currentY, containerHeight - overlaySize));
    
    // Update percentages
    overlayX = Math.round(((currentX + overlaySize / 2) / containerWidth) * 100);
    overlayY = Math.round(((currentY + overlaySize / 2) / containerHeight) * 100);
    
    // Update sliders
    document.getElementById('overlayXSlider').value = overlayX;
    document.getElementById('overlayYSlider').value = overlayY;
    document.getElementById('overlayXValue').textContent = overlayX;
    document.getElementById('overlayYValue').textContent = overlayY;
    
    updateOverlayPosition();
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
}

/**
 * Stop dragging overlay image
 */
function stopDraggingOverlay() {
    if (!isDraggingOverlay) return;
    
    isDraggingOverlay = false;
    
    const overlayImage = document.getElementById('overlayImage');
    overlayImage.classList.remove('dragging');
    
    // Regenerate preview
    if (currentImageData) {
        generatePreview();
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

/**
 * Process uploaded video file
 */
function processVideoFile(file) {
    if (!file.type.startsWith('video/')) {
        showStatus('Invalid file type. Please upload a video.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const videoPath = e.target.result;
        currentVideoPath = videoPath;
        
        // Create video element to extract metadata and first frame
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        
        video.onloadedmetadata = () => {
            currentAspectRatio = video.videoWidth / video.videoHeight;
        };
        
        video.oncanplay = () => {
            currentAspectRatio = video.videoWidth / video.videoHeight;
            currentVideoElement = video;
            currentLoadedType = 'video';
            
            // Enable looping
            video.loop = true;
            
            // Start real-time video preview
            generateVideoPreview(video);
            
            document.getElementById('actionSection').style.display = 'block';
            document.getElementById('canvasPlaceholder').style.display = 'none';
            
            showStatus('Video loaded successfully. Video is now playing. Click "Generate Video" to create ASCII art video.', 'success');
        };
        
        video.src = videoPath;
        video.play().catch(() => {});
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
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });

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
 * Generate real-time ASCII art preview from playing video
 */
function generateVideoPreview(videoElement) {
    if (!videoElement) return;

    const outputCanvas = document.getElementById('outputCanvas');
    const fontSize = calculateFontSize(OUTPUT_WIDTH, CHAR_WIDTH);
    const canvasHeight = Math.round(OUTPUT_WIDTH / currentAspectRatio);
    const charHeight = Math.round(canvasHeight / fontSize / 1.2);
    
    outputCanvas.width = OUTPUT_WIDTH;
    outputCanvas.height = canvasHeight;

    // Stop any existing animation loop
    if (animationLoop) clearInterval(animationLoop);

    // Create temporary canvas for reading video frames
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    
    // Cache context and pre-calculate values
    const ctx = outputCanvas.getContext('2d', { willReadFrequently: true });
    ctx.font = `${fontSize}px ${currentFont}`;
    ctx.textBaseline = 'top';
    
    const charWidth = CHAR_WIDTH;
    const charPixelWidth = OUTPUT_WIDTH / charWidth;
    const charPixelHeight = canvasHeight / charHeight;
    let needsBrightnessBoost = false;

    // Use requestAnimationFrame for smooth video playback
    const renderFrame = () => {
        if (!videoElement.paused || videoElement.ended === false) {
            // Draw current video frame
            tempCtx.drawImage(videoElement, 0, 0);
            const frameData = tempCtx.getImageData(0, 0, videoElement.videoWidth, videoElement.videoHeight);

            // Quick brightness check (sample only for performance)
            let avgBrightness = 0;
            const data = frameData.data;
            const sampleSize = Math.max(1, Math.floor(data.length / 400)); // Sample 1/100th of pixels
            for (let i = 0; i < data.length; i += sampleSize * 4) {
                avgBrightness += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) / 255;
            }
            avgBrightness /= (data.length / (sampleSize * 4));
            
            // Boost brightness once if needed
            if (avgBrightness < 0.3 && !needsBrightnessBoost) {
                needsBrightnessBoost = true;
                const brightnessMultiplier = 0.6 / Math.max(avgBrightness, 0.01);
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, data[i] * brightnessMultiplier);
                    data[i+1] = Math.min(255, data[i+1] * brightnessMultiplier);
                    data[i+2] = Math.min(255, data[i+2] * brightnessMultiplier);
                }
            }

            // Convert frame to ASCII
            const asciiFrame = convertFrameToASCII(frameData, charWidth, charHeight);

            // Render to output canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, OUTPUT_WIDTH, canvasHeight);

            const characters = asciiFrame.characters;
            const colors = asciiFrame.colors;
            
            for (let y = 0; y < charHeight; y++) {
                const charsRow = characters[y];
                const colorsRow = colors[y];
                for (let x = 0; x < charWidth; x++) {
                    const char = charsRow[x];
                    const color = colorsRow[x];

                    const pixelX = x * charPixelWidth;
                    const pixelY = y * charPixelHeight;

                    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
                    ctx.fillText(char, pixelX, pixelY);
                }
            }

            applyEffects(ctx, OUTPUT_WIDTH, canvasHeight);
        }

        animationLoop = requestAnimationFrame(renderFrame);
    };

    // Start the video and rendering loop
    videoElement.play().catch(() => {});
    renderFrame();
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
        const ctx = outputCanvas.getContext('2d', { willReadFrequently: true });

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
        } else if (currentMode === 'flag') {
            // Flag mode: static ASCII with waving animation (loops continuously)
            asciiFrame = convertFrameToASCII(currentImageData, currentCharWidth, charHeight);
            const flagProgress = (frameCount % 30) / 30; // Cycle every 30 frames, loops continuously
            renderASCIIFrameWithFlag(asciiFrame, outputCanvas, fontSize, renderCharHeight, flagProgress);
            frameCount++;
            return; // Skip normal render, handled by renderASCIIFrameWithFlag
        } else if (currentMode === 'dither') {
            // Dither mode: static ASCII with ordered dithering pattern
            asciiFrame = convertFrameToASCIIDither(currentImageData, currentCharWidth, charHeight);
        } else if (currentMode === 'glitch') {
            // Glitch mode: animated random displacement of chunks
            asciiFrame = convertFrameToASCIIGlitch(currentImageData, currentCharWidth, charHeight, frameCount);
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

/**
 * Convert image to ASCII using ordered dithering (Bayer matrix)
 */
function convertFrameToASCIIDither(imageData, charWidth, charHeight) {
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

            // Apply Bayer matrix dithering with threshold-based approach
            const bayerX = charX % 4;
            const bayerY = charY % 4;
            const ditherThreshold = BAYER_MATRIX_4x4[bayerY][bayerX] / 16; // Normalize to 0-1
            
            // Use threshold-based dithering with sensitivity and contrast control
            // Sensitivity controls pattern strength, Contrast controls brightness spread
            const adjustedThreshold = ditherThreshold * ditherSensitivity;
            const contrastAdjustedBrightness = (sampled.brightness - 0.5) * ditherContrast + 0.5;
            const ditheredBrightness = contrastAdjustedBrightness > adjustedThreshold ? 
                Math.min(1, contrastAdjustedBrightness + ditherSensitivity * 0.5) : 
                Math.max(0, contrastAdjustedBrightness - ditherSensitivity * 0.5);
            
            characters[charY][charX] = pixelToCharacter(ditheredBrightness);
            colors[charY][charX] = {
                r: sampled.r,
                g: sampled.g,
                b: sampled.b
            };
        }
    }

    return { characters, colors };
}

/**
 * Convert image to ASCII with glitch effect (random chunk displacement)
 */
function convertFrameToASCIIGlitch(imageData, charWidth, charHeight, frameCount) {
    const imgWidth = imageData.width;
    const imgHeight = imageData.height;

    const characters = [];
    const colors = [];

    // Calculate pixel region size
    const regionWidth = imgWidth / charWidth;
    const regionHeight = imgHeight / charHeight;

    // Create glitch displacement map that changes per frame
    const seed = frameCount * 12345; // Different seed per frame
    
    for (let charY = 0; charY < charHeight; charY++) {
        characters[charY] = [];
        colors[charY] = [];

        for (let charX = 0; charX < charWidth; charX++) {
            // Random number generator seeded by position and frame
            const hash = Math.abs(Math.sin((charX + charY * charWidth + seed) * 0.1) * 10000);
            const rand = hash - Math.floor(hash);
            
            // Decide if this chunk gets displaced (based on glitch intensity)
            const glitchChance = glitchIntensity / 20; // Convert to probability
            let pixelX = Math.floor(charX * regionWidth);
            let pixelY = Math.floor(charY * regionHeight);
            
            if (rand < glitchChance) {
                // Randomly pull from a different part of the image
                const offsetX = Math.floor((Math.sin(hash * 1.3) * glitchIntensity + glitchIntensity) * regionWidth);
                const offsetY = Math.floor((Math.cos(hash * 1.7) * glitchIntensity + glitchIntensity) * regionHeight);
                
                pixelX = (pixelX + offsetX) % imgWidth;
                pixelY = (pixelY + offsetY) % imgHeight;
            }

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
    
    // Apply effects
    applyEffects(ctx, canvas.width, canvas.height);
}

/**
 * Apply post-processing effects to canvas
 */
function applyEffects(ctx, width, height) {
    const canvas = ctx.canvas;
    
    // Build CSS filter string
    let filterString = '';
    
    if (saturation !== 100) {
        filterString += `saturate(${saturation / 100}) `;
    }
    
    if (hue !== 0) {
        filterString += `hue-rotate(${hue}deg) `;
    }
    
    if (grayscale !== 0) {
        filterString += `grayscale(${grayscale / 100}) `;
    }
    
    if (invert !== 0) {
        filterString += `invert(${invert / 100}) `;
    }
    
    if (blur !== 0) {
        filterString += `blur(${blur}px) `;
    }
    
    if (sepia !== 0) {
        filterString += `sepia(${sepia / 100}) `;
    }
    
    if (brightnessBoost !== 0) {
        filterString += `brightness(${1 + brightnessBoost / 100}) `;
    }
    
    // Warmth: shift toward warmer (orange) or cooler (blue) tones
    if (warmth > 0) {
        // Warm: increase red, decrease blue
        filterString += `drop-shadow(0 0 ${warmth}px rgba(255, 100, 0, 0.3)) `;
    } else if (warmth < 0) {
        // Cool: increase blue, decrease red
        filterString += `drop-shadow(0 0 ${Math.abs(warmth)}px rgba(0, 100, 255, 0.3)) `;
    }
    
    // Apply all CSS filters to canvas
    canvas.style.filter = filterString || 'none';
    
    // Opacity effect
    if (opacity !== 100) {
        canvas.style.opacity = opacity / 100;
    } else {
        canvas.style.opacity = 1;
    }
    
    // Brightness effect (canvas-based overlay)
    if (brightness !== 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(brightness) / 200})`;
        if (brightness > 0) {
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.abs(brightness) / 200})`;
            ctx.fillRect(0, 0, width, height);
        }
    }

    // Contrast effect
    if (contrast !== 100) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, factor * (data[i] - 128) + 128);
            data[i + 1] = Math.min(255, factor * (data[i + 1] - 128) + 128);
            data[i + 2] = Math.min(255, factor * (data[i + 2] - 128) + 128);
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Glow effect - add bright outer glow
    if (glow > 0) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const glowAmount = glow / 10;
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] + glowAmount * 20);
            data[i + 1] = Math.min(255, data[i + 1] + glowAmount * 20);
            data[i + 2] = Math.min(255, data[i + 2] + glowAmount * 20);
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Shadow effect - darken for depth
    if (shadow > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${shadow / 40})`;
        ctx.fillRect(0, 0, width, height);
    }

    // Vignette effect
    if (vignette > 0) {
        const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.sqrt(width * width + height * height) / 2);
        gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${vignette})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
}

/**
 * Render ASCII frame with waving flag effect (loops continuously)
 */
function renderASCIIFrameWithFlag(asciiFrame, canvas, fontSize, charHeight, progress) {
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

    // Calculate waving offset using sine wave (loops continuously)
    const waveOffset = Math.sin(progress * Math.PI * 2) * flagDistance * flagSpeed / 30;

    // Draw each character with waving effect
    for (let y = 0; y < charHeight; y++) {
        for (let x = 0; x < charWidth; x++) {
            const char = asciiFrame.characters[y][x];
            const color = asciiFrame.colors[y][x];

            // Add per-character vertical variation based on x position (creates wave effect)
            const charVariation = Math.sin((x * 0.1 + progress * Math.PI * 2) / 2) * flagDistance * flagSpeed / 30;
            const pixelX = x * charPixelWidth;
            const pixelY = y * charPixelHeight + waveOffset + charVariation;

            // Set color
            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;

            // Draw character
            ctx.fillText(char, pixelX, pixelY);
        }
    }
    
    // Apply effects
    applyEffects(ctx, canvas.width, canvas.height);
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
// VIDEO GENERATION
// ============================================================================

/**
 * Generate ASCII art video from uploaded video with overlayed effects
 */
async function generateVideoFromVideo(videoPath, onProgress) {
    try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.loop = true; // Enable looping
        
        let videoWidth, videoHeight, videoDuration;
        
        video.onerror = () => {
            throw new Error('Failed to load video');
        };
        
        // Wait for metadata to load
        video.src = videoPath;
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                videoWidth = video.videoWidth;
                videoHeight = video.videoHeight;
                videoDuration = video.duration;
                resolve();
            };
        });

        currentAspectRatio = videoWidth / videoHeight;
        
        const fontSize = calculateFontSize(OUTPUT_WIDTH, CHAR_WIDTH);
        const outputHeight = Math.round(OUTPUT_WIDTH / currentAspectRatio);
        const charHeight = Math.round(outputHeight / fontSize / 1.2);
        
        // Get desired output duration from UI (default 5 seconds)
        const outputDuration = parseInt(document.getElementById('durationInput').value) || 5;
        const videoFPS = 30;
        const totalFrames = outputDuration * videoFPS;
        const frames = [];
        
        // Extract frames from video with looping support
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            // Calculate time in video, looping if necessary
            const time = (frameIndex / videoFPS) % videoDuration;
            video.currentTime = time;
            
            // Wait for frame to load
            await new Promise((resolve) => {
                let seekHandler = null;
                const timeout = setTimeout(() => {
                    // Timeout fallback - if seek doesn't work, try playing briefly
                    if (seekHandler) video.removeEventListener('seeked', seekHandler);
                    video.play().catch(() => {});
                    resolve();
                }, 200);
                
                seekHandler = () => {
                    clearTimeout(timeout);
                    video.removeEventListener('seeked', seekHandler);
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = videoWidth;
                    canvas.height = videoHeight;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0);
                    
                    const frameData = ctx.getImageData(0, 0, videoWidth, videoHeight);
                    
                    // Convert frame to ASCII
                    let asciiFrame;
                    
                    if (currentMode === 'original') {
                        asciiFrame = convertFrameToASCII(frameData, currentCharWidth, charHeight);
                    } else if (currentMode === 'scroll') {
                        asciiFrame = convertFrameToASCII(frameData, currentCharWidth, charHeight);
                    } else if (currentMode === 'zoom') {
                        const cycleLength = Math.floor(totalFrames / 3);
                        const progress = (frameIndex % cycleLength) / cycleLength;
                        const zoomCharWidth = getZoomCharWidth(progress);
                        const zoomCharHeight = Math.round(zoomCharWidth / currentAspectRatio);
                        asciiFrame = convertFrameToASCII(frameData, zoomCharWidth, zoomCharHeight);
                    } else if (currentMode === 'dither') {
                        asciiFrame = convertFrameToASCIIDither(frameData, currentCharWidth, charHeight);
                    } else if (currentMode === 'glitch') {
                        asciiFrame = convertFrameToASCIIGlitch(frameData, currentCharWidth, charHeight, frameIndex);
                    } else {
                        asciiFrame = convertFrameToASCII(frameData, currentCharWidth, charHeight);
                    }
                    
                    // Render ASCII frame
                    const tempVideoCanvas = document.createElement('canvas');
                    tempVideoCanvas.width = OUTPUT_WIDTH;
                    tempVideoCanvas.height = outputHeight;
                    
                    const tempCtx = tempVideoCanvas.getContext('2d');
                    tempCtx.fillStyle = '#000000';
                    tempCtx.fillRect(0, 0, OUTPUT_WIDTH, outputHeight);
                    
                    if (currentMode === 'flag') {
                        const flagProgress = (frameIndex % 30) / 30;
                        renderASCIIFrameWithFlag(asciiFrame, tempVideoCanvas, fontSize, charHeight, flagProgress);
                    } else if (currentMode === 'scroll') {
                        const shiftedFrame = shiftASCIIFrame(asciiFrame, frameIndex % currentCharWidth);
                        renderASCIIFrame(shiftedFrame, tempVideoCanvas, fontSize, charHeight);
                    } else if (currentMode === 'zoom') {
                        const cycleLength = Math.floor(totalFrames / 3);
                        const zoomCharWidth = getZoomCharWidth((frameIndex % cycleLength) / cycleLength);
                        const zoomCharHeight = Math.round(zoomCharWidth / currentAspectRatio);
                        renderASCIIFrame(asciiFrame, tempVideoCanvas, fontSize, zoomCharHeight);
                    } else {
                        renderASCIIFrame(asciiFrame, tempVideoCanvas, fontSize, charHeight);
                    }
                    
                    frames.push(tempCtx.getImageData(0, 0, OUTPUT_WIDTH, outputHeight));
                    onProgress(Math.round((frameIndex / totalFrames) * 30));
                    resolve();
                };
                
                video.addEventListener('seeked', seekHandler, { once: true });
            });
        }

        // Encode frames to MP4
        const videoBlob = await encodeToMP4(frames, outputDuration, (percent) => {
            onProgress(30 + Math.round(percent * 0.7));
        });

        window.generatedVideoBlob = videoBlob;

        onProgress(100);
        showStatus('Video generated successfully! Click "Download Video" to save.', 'success');
        document.getElementById('downloadButton').style.display = 'inline-block';

    } catch (error) {
        console.error('Error generating video:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
        const progressSection = document.getElementById('progressSection');
        const actionSection = document.getElementById('actionSection');
        progressSection.style.display = 'none';
        actionSection.style.display = 'block';
        document.getElementById('generateButton').disabled = false;
        
        if (currentImageData) {
            generatePreview();
        }
    }
}

/**
 * Generate video from current image
 */
async function generateVideo() {
    if (!currentImageData || !ffmpegReady) {
        showStatus('Please upload an image or video first or wait for FFmpeg to load.', 'error');
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
        // If video input, use generateVideoFromVideo instead
        if (currentInputType === 'video' && currentVideoPath) {
            await generateVideoFromVideo(currentVideoPath, (percent) => {
                updateProgress(percent);
            });
            return;
        }

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
            } else if (currentMode === 'flag') {
                // Flag mode: static ASCII with waving animation (loops continuously)
                if (i === 0) {
                    asciiFrame = convertFrameToASCII(currentImageData, currentCharWidth, charHeight);
                    cachedASCIIFrame = asciiFrame;
                } else {
                    asciiFrame = cachedASCIIFrame;
                }
            } else if (currentMode === 'dither') {
                // Dither mode: static ASCII with ordered dithering pattern
                if (i === 0) {
                    asciiFrame = convertFrameToASCIIDither(currentImageData, currentCharWidth, charHeight);
                    cachedASCIIFrame = asciiFrame;
                } else {
                    asciiFrame = cachedASCIIFrame;
                }
            } else if (currentMode === 'glitch') {
                // Glitch mode: random displacement animation changes every frame
                asciiFrame = convertFrameToASCIIGlitch(currentImageData, currentCharWidth, charHeight, i);
            }

            // Render frame to temporary canvas
            const tempVideoCanvas = document.createElement('canvas');
            tempVideoCanvas.width = videoWidth;
            tempVideoCanvas.height = videoHeight;
            
            const ctx = tempVideoCanvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, videoWidth, videoHeight);
            
            // Use flag rendering for flag mode, normal rendering for others
            if (currentMode === 'flag') {
                const flagProgress = (i % 30) / 30; // 30-frame cycle (loops continuously)
                renderASCIIFrameWithFlag(asciiFrame, tempVideoCanvas, fontSize, renderCharHeight, flagProgress);
            } else {
                renderASCIIFrame(asciiFrame, tempVideoCanvas, fontSize, renderCharHeight);
            }

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
    if (!ffmpegReady || !ffmpeg) {
        throw new Error('FFmpeg not ready');
    }

    const framerate = 30;
    const totalFrames = frames.length;
    
    // Determine which API to use
    const useOldAPI = ffmpeg._oldAPI;
    
    // Helper functions for file operations
    const writeFile = (name, data) => {
        if (useOldAPI) {
            ffmpeg.FS('writeFile', name, data);
        } else if (ffmpeg.FS && typeof ffmpeg.FS.writeFile === 'function') {
            ffmpeg.FS.writeFile(name, data);
        } else if (ffmpeg.FS && typeof ffmpeg.FS === 'function') {
            ffmpeg.FS('writeFile', name, data);
        } else {
            throw new Error('No writeFile method available');
        }
    };
    
    const readFile = (name) => {
        if (useOldAPI) {
            return ffmpeg.FS('readFile', name);
        } else if (ffmpeg.FS && typeof ffmpeg.FS.readFile === 'function') {
            return ffmpeg.FS.readFile(name);
        } else if (ffmpeg.FS && typeof ffmpeg.FS === 'function') {
            return ffmpeg.FS('readFile', name);
        } else {
            throw new Error('No readFile method available');
        }
    };
    
    const unlinkFile = (name) => {
        try {
            if (useOldAPI) {
                ffmpeg.FS('unlink', name);
            } else if (ffmpeg.FS && typeof ffmpeg.FS.unlink === 'function') {
                ffmpeg.FS.unlink(name);
            } else if (ffmpeg.FS && typeof ffmpeg.FS === 'function') {
                ffmpeg.FS('unlink', name);
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    };

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

        // Write file
        try {
            writeFile(fileName, fileData);
        } catch (error) {
            console.error('WriteFile error details:', error);
            throw new Error(`Failed to write file: ${error.message}`);
        }

        if (onProgress) {
            onProgress((i / totalFrames) * 100);
        }
    }

    // Run FFmpeg to create video
    try {
        await ffmpeg.run(
            '-framerate', String(framerate),
            '-pattern_type', 'glob',
            '-i', 'frame_*.ppm',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'medium',
            '-crf', '23',
            'output.mp4'
        );
    } catch (error) {
        console.error('FFmpeg run error:', error);
        throw new Error(`FFmpeg encoding failed: ${error.message}`);
    }

    // Read output video file
    let videoData;
    try {
        videoData = readFile('output.mp4');
    } catch (error) {
        console.error('ReadFile error details:', error);
        throw new Error(`Failed to read video file: ${error.message}`);
    }

    const videoBlob = new Blob([videoData.buffer || videoData], { type: 'video/mp4' });

    // Clean up FFmpeg filesystem
    unlinkFile('output.mp4');
    for (let i = 0; i < totalFrames; i++) {
        const fileName = `frame_${String(i).padStart(6, '0')}.ppm`;
        unlinkFile(fileName);
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
