// --- 0. Global Error Handling (Diagnostics) ---
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const memInfo = (window.performance && window.performance.memory) 
        ? Math.round(window.performance.memory.usedJSHeapSize / 1048576) + 'MB' 
        : 'N/A';
        
    const errorInfo = [
        'ERROR: ' + msg,
        'Line: ' + lineNo,
        'Column: ' + columnNo,
        'Stack: ' + (error ? error.stack : 'N/A'),
        'UserAgent: ' + navigator.userAgent,
        'Memory: ' + memInfo
    ].join('\n');
    
    alert("⚠️ Application Error:\n" + errorInfo + "\n\nPlease take a screenshot of this alert.");
    return false; // Let default handler run as well
};

window.onunhandledrejection = function(event) {
    alert("⚠️ Async Error: " + event.reason);
};

function showDiagnostics() {
    const canvas = document.getElementById('patternCanvas');
    const pCanvas = document.getElementById('processCanvas');
    
    const diag = [
        '--- SYSTEM DIAGNOSTICS ---',
        'User Agent: ' + navigator.userAgent,
        'Screen: ' + window.screen.width + 'x' + window.screen.height,
        'Window: ' + window.innerWidth + 'x' + window.innerHeight,
        'Device Pixel Ratio: ' + window.devicePixelRatio,
        '',
        '--- MEMORY (If Available) ---',
        'Used JS Heap: ' + (window.performance && window.performance.memory ? Math.round(window.performance.memory.usedJSHeapSize / 1048576) + 'MB' : 'N/A'),
        '',
        '--- APPLICATION STATE ---',
        'Grid Dimensions: ' + state.cols + ' x ' + state.rows,
        'Cell Size: ' + state.cellSize,
        'Canvas Size: ' + (canvas ? canvas.width + 'x' + canvas.height : 'Not created'),
        'Image Loaded: ' + (state.imageObj ? 'Yes (' + state.imageObj.width + 'x' + state.imageObj.height + ')' : 'No'),
        'Image URL: ' + (state.imageUrl ? 'Active (Blob)' : 'None'),
        'Grid Data Points: ' + (state.gridData.length ? state.gridData.length * state.gridData[0].length : 0)
    ].join('\n');
    
    alert(diag);
}

// --- Constants & Config ---
const MARGIN = 40;
const DEFAULT_PALETTE_SIZE = 2;
const DEFAULT_GRID_SIZE = 100;
const state = {
    imageUrl: null, // Using object URL instead of Image object to save memory
    imageObj: null,
    gridData: [], 
    cols: DEFAULT_GRID_SIZE,
    rows: DEFAULT_GRID_SIZE,
    maxColors: DEFAULT_PALETTE_SIZE,
    cellSize: 15,
    isDrawing: false,
    currentTool: 'pencil',
    currentColor: '#ef4444',
    showGrid: true,
    showSections: false,
    aspectRatio: 1,
    lockRatio: true,
    contrast: 0,
    density: 55,
    zoom: 1,
    baseCellSize: 15,
    lineStart: null,
};

// --- DOM Elements ---
const $ = id => document.getElementById(id);
const els = {
    fileInput: $('fileInput'),
    sourcePreview: $('sourcePreview'),
    widthNum: $('widthNum'),
    heightNum: $('heightNum'),
    unlockRatio: $('unlockRatio'),
    contrastInput: $('contrastNum'),
    colorCountInput: $('colorCountNum'),
    densityInput: $('densityNum'),
    paletteDisplay: $('paletteDisplay'),
    processBtn: $('processBtn'),
    exportBtn: $('exportBtn'),
    exportSectionsBtn: $('exportSectionsBtn'),
    saveBtn: $('saveBtn'),
    canvas: $('patternCanvas'),
    processCanvas: $('processCanvas'),
    colorPicker: $('colorPicker'),
    activeColorDisplay: $('activeColorDisplay'),
    colorHex: $('colorHex'),
    toolPencil: $('toolPencil'),
    toolEraser: $('toolEraser'),
    toolFill: $('toolFill'),
    toolLine: $('toolLine'),
    toolRectangle: $('toolRectangle'),
    batchReplaceBtn: $('batchReplaceBtn'),
    emptyState: $('emptyState'),
    coordinates: $('coordinates'),
    showGridLines: $('showGridLines'),
    showSections: $('showSections'),
    statusText: $('statusText'),
    debugBtn: $('debugBtn'),
    zoomInBtn: $('zoomInBtn'),
    zoomOutBtn: $('zoomOutBtn'),
    zoomLevel: $('zoomLevel'),
};

const ctx = els.canvas.getContext('2d', { alpha: false });
const pCtx = els.processCanvas.getContext('2d', { willReadFrequently: true });

// --- Initialization ---
function init() {
    // Debug button
    els.debugBtn.addEventListener('click', showDiagnostics);

    // File Upload
    els.fileInput.addEventListener('change', (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;

            if (file.type === "application/json") {
                loadProject(file);
            } else if (file.type.startsWith("image/")) {
                loadImage(file);
            } else {
                alert("Unsupported file type. Please upload an image or a .json project file.");
            }
        } catch(err) {
            console.error(err);
            alert("Critical error during file processing: " + err.message);
        }
    });
    
    // Inputs
    els.widthNum.addEventListener('input', (e) => updateWidth(e.target.value));
    els.heightNum.addEventListener('input', (e) => state.rows = parseInt(e.target.value) || 10);
    els.unlockRatio.addEventListener('change', (e) => {
        state.lockRatio = !e.target.checked;
        els.heightNum.disabled = state.lockRatio;
        if(state.lockRatio && state.imageObj) calculateRows();
    });

    els.contrastInput.addEventListener('input', (e) => state.contrast = parseInt(e.target.value) || 0);
    els.densityInput.addEventListener('input', (e) => {
        state.density = parseInt(e.target.value) || 55;
        if(state.gridData.length) render();
    });
    els.colorCountInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (val < 2) val = 2;
        if (val > 64) val = 64; 
        state.maxColors = val;
    });

    els.processBtn.addEventListener('click', () => {
        els.statusText.textContent = "Processing...";
        setTimeout(generateGrid, 50);
    });
    
    // Tools
    els.colorPicker.addEventListener('input', (e) => updateCurrentColor(e.target.value));
    els.batchReplaceBtn.addEventListener('click', batchReplaceColor);
    els.toolPencil.addEventListener('click', () => setTool('pencil'));
    els.toolEraser.addEventListener('click', () => setTool('eraser'));
    els.toolFill.addEventListener('click', () => setTool('fill'));
    els.toolLine.addEventListener('click', () => setTool('line'));
    els.toolRectangle.addEventListener('click', () => setTool('rectangle'));
    
    els.showGridLines.addEventListener('change', (e) => { state.showGrid = e.target.checked; render(); });
    els.showSections.addEventListener('change', (e) => { state.showSections = e.target.checked; render(); });

    // Actions
    els.exportBtn.addEventListener('click', exportImage);
    els.exportSectionsBtn.addEventListener('click', exportSections);
    els.saveBtn.addEventListener('click', saveProject);

    // Canvas Drawing
    els.canvas.addEventListener('mousedown', startDrawing);
    els.canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    // Zoom
    els.zoomInBtn.addEventListener('click', () => updateZoom('in'));
    els.zoomOutBtn.addEventListener('click', () => updateZoom('out'));
}

function loadImage(file) {
    // Cleanup previous object URL to prevent memory leak
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);

    state.imageUrl = URL.createObjectURL(file);
    
    const img = new Image();
    img.onload = () => {
        state.imageObj = img;
        state.aspectRatio = img.width / img.height;
        
        els.sourcePreview.src = state.imageUrl;
        els.sourcePreview.classList.remove('hidden');
        els.processBtn.disabled = false;
        els.emptyState.style.display = 'none';

        if (state.lockRatio) calculateRows();
        
        // Auto generate on load
        els.statusText.textContent = "Processing image...";
        requestAnimationFrame(generateGrid);
    };
    img.onerror = () => {
        alert("Error loading image. The file may be corrupt or too large.");
    };
    img.src = state.imageUrl;
}

function updateWidth(val) {
    let v = parseInt(val);
    if (v > 5000) v = 5000;
    if (v < 1) v = 1;
    state.cols = v;
    els.widthNum.value = v;
    if (state.lockRatio) calculateRows();
}

function calculateRows() {
    if (!state.imageObj) return;
    state.rows = Math.round(state.cols / state.aspectRatio);
    els.heightNum.value = state.rows;
}

function generateGrid() {
    try {
        if (!state.imageObj) return;

        const maxPixels = 25000000; // Cap at 25MP
        if (state.cols * state.rows > maxPixels) {
            alert("Grid is too large (over 25MP). Please reduce dimensions to prevent crash.");
            els.statusText.textContent = "Error: Too large";
            return;
        }

        // Calculate cell size
        const maxCanvasDim = 30000; // Browser safety limit
        const neededWidth = state.cols * 15;
        const neededHeight = state.rows * 15;
        
        state.baseCellSize = 15;
        if (neededWidth > maxCanvasDim || neededHeight > maxCanvasDim) {
            const scale = maxCanvasDim / Math.max(state.cols, state.rows);
            state.baseCellSize = Math.floor(scale);
            if (state.baseCellSize < 1) state.baseCellSize = 1;
        }
        state.cellSize = state.baseCellSize * state.zoom;

        // Resize and Read Pixel Data
        els.processCanvas.width = state.cols;
        els.processCanvas.height = state.rows;
        
        // Clear and filter
        pCtx.clearRect(0, 0, state.cols, state.rows);
        if (state.contrast !== 0) {
            pCtx.filter = `contrast(${100 + state.contrast}%)`;
        } else {
            pCtx.filter = 'none';
        }
        
        // Draw image resized to grid dimensions
        pCtx.drawImage(state.imageObj, 0, 0, state.cols, state.rows);
        pCtx.filter = 'none';

        const imageData = pCtx.getImageData(0, 0, state.cols, state.rows);
        const quantizedData = quantizeColors(imageData.data, state.maxColors);
        
        // Transform to grid structure
        state.gridData = [];
        const paletteSet = new Set();
        let ptr = 0;
        
        for (let y = 0; y < state.rows; y++) {
            const row = new Array(state.cols);
            for (let x = 0; x < state.cols; x++) {
                const r = quantizedData[ptr];
                const g = quantizedData[ptr+1];
                const b = quantizedData[ptr+2];
                const a = quantizedData[ptr+3];
                ptr += 4;

                if (a < 50) {
                    row[x] = null;
                } else {
                    const hex = rgbToHex(r, g, b);
                    row[x] = hex;
                    paletteSet.add(hex);
                }
            }
            state.gridData.push(row);
        }

        updatePaletteDisplay(Array.from(paletteSet));
        resizeCanvas();
        render();
        
        els.exportBtn.disabled = false;
        els.exportSectionsBtn.disabled = false;
        els.saveBtn.disabled = false;
        els.statusText.textContent = `Generated ${state.cols}x${state.rows}`;
    } catch (e) {
        console.error(e);
        alert("Error generating grid: " + e.message + "\nTry reducing the column count.");
        els.statusText.textContent = "Error";
    }
}

// --- Color Logic ---

function quantizeColors(data, k) {
    // Simple optimization: if image is huge, sample less pixels for K-means training
    const step = data.length > 400000 ? 20 : 1; 
    
    const pixels = [];
    for (let i = 0; i < data.length; i += 4 * step) {
        if (data[i + 3] > 127) {
            pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
    }

    if (pixels.length === 0) return data;

    // Initialize centroids randomly
    let centroids = [];
    for (let i = 0; i < k; i++) {
        const p = pixels[Math.floor(Math.random() * pixels.length)];
        centroids.push(p ? { ...p } : {r:128,g:128,b:128});
    }

    // K-Means Iterations
    for (let iter = 0; iter < 5; iter++) {
        const clusters = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
        
        pixels.forEach(p => {
            let minDist = Infinity;
            let idx = 0;
            centroids.forEach((c, i) => {
                const dist = (p.r - c.r)**2 + (p.g - c.g)**2 + (p.b - c.b)**2;
                if (dist < minDist) { minDist = dist; idx = i; }
            });
            clusters[idx].r += p.r;
            clusters[idx].g += p.g;
            clusters[idx].b += p.b;
            clusters[idx].count++;
        });

        centroids = clusters.map((c, i) => {
            if (c.count === 0) return centroids[i];
            return { 
                r: Math.round(c.r / c.count), 
                g: Math.round(c.g / c.count), 
                b: Math.round(c.b / c.count) 
            };
        });
    }

    // Map all pixels to nearest centroid
    const result = new Uint8ClampedArray(data.length);
    for(let i=0; i<data.length; i+=4) {
        if (data[i+3] < 127) {
            result[i+3] = 0;
            continue;
        }
        let minDist = Infinity;
        let bestC = centroids[0];
        for(let j=0; j<centroids.length; j++) {
             const c = centroids[j];
             const dist = (data[i] - c.r)**2 + (data[i+1] - c.g)**2 + (data[i+2] - c.b)**2;
             if(dist < minDist) { minDist = dist; bestC = c; }
        }
        result[i] = bestC.r;
        result[i+1] = bestC.g;
        result[i+2] = bestC.b;
        result[i+3] = 255;
    }
    return result;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function updatePaletteDisplay(colors) {
    els.paletteDisplay.innerHTML = '';
    colors.sort();
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.style.backgroundColor = color;
        swatch.title = "Use " + color;
        swatch.onclick = () => {
            updateCurrentColor(color);
            setTool('pencil');
        };
        els.paletteDisplay.appendChild(swatch);
    });
}

function updateCurrentColor(hex) {
    state.currentColor = hex;
    els.colorPicker.value = hex;
    els.activeColorDisplay.style.backgroundColor = hex;
    els.colorHex.textContent = hex.toUpperCase();
}

function batchReplaceColor() {
    if (!state.gridData.length) return;
    const targetHex = state.currentColor;
    
    // Create a temp color input just for this action
    const tempInput = document.createElement('input');
    tempInput.type = 'color';
    tempInput.value = targetHex;
    
    // Listen for selection
    tempInput.oninput = (e) => {
        const newHex = e.target.value;
        if (newHex === targetHex) return;
        
        let count = 0;
        for(let y=0; y<state.rows; y++) {
            for(let x=0; x<state.cols; x++) {
                if (state.gridData[y][x] === targetHex) {
                    state.gridData[y][x] = newHex;
                    count++;
                }
            }
        }
        updateCurrentColor(newHex);
        // Rebuild palette
        const newPalette = new Set();
        state.gridData.flat().forEach(c => { if(c) newPalette.add(c) });
        updatePaletteDisplay(Array.from(newPalette));
        render();
        els.statusText.textContent = `Replaced ${count} cells`;
    };
    tempInput.click();
}

// --- Rendering ---

function resizeCanvas() {
    els.canvas.width = (state.cols * state.cellSize) + MARGIN + MARGIN;
    els.canvas.height = (state.rows * state.cellSize) + MARGIN + MARGIN;
}

function render() {
    // White Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);

    // Margin areas
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, MARGIN, els.canvas.height); // Left
    ctx.fillRect(0, 0, els.canvas.width, MARGIN); // Top
    ctx.fillRect(els.canvas.width - MARGIN, 0, MARGIN, els.canvas.height); // Right
    ctx.fillRect(0, els.canvas.height - MARGIN, els.canvas.width, MARGIN); // Bottom

    ctx.save();
    ctx.translate(MARGIN, MARGIN);

    // Draw Cells
    for (let y = 0; y < state.rows; y++) {
        for (let x = 0; x < state.cols; x++) {
            const color = state.gridData[y][x];
            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
            }
        }
    }

    // Draw Grid Lines
    if (state.showGrid && state.cellSize > 2) {
        const gridWidth = state.cols * state.cellSize;
        const gridHeight = state.rows * state.cellSize;

        ctx.beginPath();

        // Vertical lines
        for (let x = 0; x <= state.cols; x++) {
            if (x % 10 === 0) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            } else if (x % 5 === 0) {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            } else {
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            }
            ctx.moveTo(x * state.cellSize, 0);
            ctx.lineTo(x * state.cellSize, gridHeight);
            ctx.stroke();
            ctx.beginPath(); // Start a new path for the next line
        }

        // Horizontal lines
        for (let y = 0; y <= state.rows; y++) {
            if (y % 10 === 0) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            } else if (y % 5 === 0) {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            } else {
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            }
            ctx.moveTo(0, y * state.cellSize);
            ctx.lineTo(gridWidth, y * state.cellSize);
            ctx.stroke();
            ctx.beginPath(); // Start a new path for the next line
        }
    }

    // Section Lines (100x100)
    if (state.showSections) {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ef4444';
        for (let x = 0; x <= state.cols; x += 100) {
            ctx.moveTo(x * state.cellSize, 0);
            ctx.lineTo(x * state.cellSize, state.rows * state.cellSize);
        }
        for (let y = 0; y <= state.rows; y += 100) {
            ctx.moveTo(0, y * state.cellSize);
            ctx.lineTo(state.cols * state.cellSize, y * state.cellSize);
        }
        ctx.stroke();
    }

    ctx.restore();

    // --- AXES & LABELS ---
    ctx.fillStyle = "#475569";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "10px sans-serif";

    // Top Axis (Cols)
    for (let i = 10; i <= state.cols; i += 10) {
        const x = state.cols - i;
        const xPos = MARGIN + (x * state.cellSize);
        ctx.fillText(i, xPos, MARGIN / 2);
        ctx.fillRect(xPos, MARGIN - 5, 1, 5);
    }

    // Left Axis (Rows)
    for (let i = 10; i <= state.rows; i += 10) {
        const y = state.rows - i;
        const yPos = MARGIN + (y * state.cellSize);
        ctx.fillText(i, MARGIN / 2, yPos);
        ctx.fillRect(MARGIN - 5, yPos, 5, 1);
    }
    
    // In-grid 10x10 labels
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let newRow = 10; newRow <= state.rows; newRow += 10) {
        for (let newCol = 10; newCol <= state.cols; newCol += 10) {
            const x = state.cols - newCol; // grid index
            const y = state.rows - newRow; // grid index
            
            if (x >= 0 && x < state.cols && y >= 0 && y < state.rows) {
                const xPos = MARGIN + x * state.cellSize + 2;
                const yPos = MARGIN + y * state.cellSize + 2;
                ctx.fillText(`${newCol},${newRow}`, xPos, yPos);
            }
        }
    }

    // Bottom Axis (CM)
    const stitchesPerCm = state.density / 10;
    const pixelsPerCm = state.cellSize * stitchesPerCm;
    const widthCm = state.cols / stitchesPerCm;
    
    for (let cm = 5; cm <= widthCm; cm += 5) {
        const xPos = MARGIN + (cm * pixelsPerCm);
        ctx.fillText(cm + "cm", xPos, els.canvas.height - (MARGIN / 2));
        ctx.fillRect(xPos, els.canvas.height - MARGIN, 1, 5);
    }
}

// --- Interaction ---

function floodFill(col, row) {
    if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return;

    const targetColor = state.gridData[row][col];
    const fillColor = state.currentColor;

    if (targetColor === fillColor) return;

    const queue = [[col, row]];
    let count = 0;

    while (queue.length > 0) {
        const [c, r] = queue.shift();

        if (c < 0 || c >= state.cols || r < 0 || r >= state.rows) continue;
        if (state.gridData[r][c] !== targetColor) continue;

        state.gridData[r][c] = fillColor;
        count++;

        queue.push([c + 1, r]);
        queue.push([c - 1, r]);
        queue.push([c, r + 1]);
        queue.push([c, r - 1]);
    }
    
    if (count > 0) {
        render();
        els.statusText.textContent = `Filled ${count} cells`;
    }
}

function updateZoom(direction) {
    const zoomStep = 0.25;
    if (direction === 'in') {
        state.zoom += zoomStep;
    } else {
        state.zoom -= zoomStep;
    }

    if (state.zoom > 4) state.zoom = 4;
    if (state.zoom < 0.25) state.zoom = 0.25;

    state.cellSize = state.baseCellSize * state.zoom;
    els.zoomLevel.textContent = `${Math.round(state.zoom * 100)}%`;

    if (state.gridData.length) {
        resizeCanvas();
        render();
    }
}

function setTool(tool) {
    state.currentTool = tool;
    
    // Reset all tool buttons
    els.toolPencil.classList.remove('active');
    els.toolEraser.classList.remove('active');
    els.toolFill.classList.remove('active');
    els.toolLine.classList.remove('active');
    els.toolRectangle.classList.remove('active');

    // Activate the current one
    if (tool === 'pencil') {
        els.toolPencil.classList.add('active');
    } else if (tool === 'eraser') {
        els.toolEraser.classList.add('active');
    } else if (tool === 'fill') {
        els.toolFill.classList.add('active');
    } else if (tool === 'line') {
        els.toolLine.classList.add('active');
    } else if (tool === 'rectangle') {
        els.toolRectangle.classList.add('active');
    }
}

function getGridCoordinates(e) {
    const rect = els.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const gridX = x - MARGIN;
    const gridY = y - MARGIN;
    
    const col = Math.floor(gridX / state.cellSize);
    const row = Math.floor(gridY / state.cellSize);
    return { col, row };
}

function startDrawing(e) {
    if (state.currentTool === 'fill') {
        const { col, row } = getGridCoordinates(e);
        floodFill(col, row);
        return;
    }
    state.isDrawing = true;
    paint(e);
}

function stopDrawing() {
    state.isDrawing = false;
}

function draw(e) {
    const { col, row } = getGridCoordinates(e);
    if (col >= 0 && col < state.cols && row >= 0 && row < state.rows) {
        els.coordinates.textContent = `${state.cols - col}, ${state.rows - row}`;
    }
    if (state.isDrawing) paint(e);
}

function paint(e) {
    if (!state.gridData.length) return;
    const { col, row } = getGridCoordinates(e);
    if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return;

    if (state.currentTool === 'pencil') {
        if (state.gridData[row][col] !== state.currentColor) {
            state.gridData[row][col] = state.currentColor;
            
            // Instant feedback draw
            const drawX = MARGIN + (col * state.cellSize);
            const drawY = MARGIN + (row * state.cellSize);
            ctx.fillStyle = state.currentColor;
            ctx.fillRect(drawX, drawY, state.cellSize, state.cellSize);
            
            if(state.showGrid && state.cellSize > 2) {
                ctx.strokeRect(drawX, drawY, state.cellSize, state.cellSize);
            }
        }
    } else if (state.currentTool === 'eraser') {
        if (state.gridData[row][col] !== null) {
            state.gridData[row][col] = null;
            const drawX = MARGIN + (col * state.cellSize);
            const drawY = MARGIN + (row * state.cellSize);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(drawX, drawY, state.cellSize, state.cellSize);
        }
    }
}

function exportImage() {
    const link = document.createElement('a');
    link.download = `stitch-pattern-${state.cols}x${state.rows}.png`;
    link.href = els.canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportSections() {
    if (!state.gridData.length) return;
    const sectionSize = 100;
    const win = window.open('', '_blank');
    if(!win) { alert("Pop-up blocked."); return; }

    win.document.write(`
        <html><head><title>Pattern Sections</title>
        <style>
            body{font-family:sans-serif;padding:20px;background:#f0f0f0}
            .section{margin-bottom:40px;background:white;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
            img{max-width:100%;border:1px solid #ccc;image-rendering:pixelated}
            @media print{body{background:white}.section{break-inside:avoid;box-shadow:none}}
        </style></head><body><h1>Pattern Sections</h1>`);

    for (let y = 0; y < state.rows; y += sectionSize) {
        for (let x = 0; x < state.cols; x += sectionSize) {
            const w = Math.min(sectionSize, state.cols - x);
            const h = Math.min(sectionSize, state.rows - y);

            const tCanvas = document.createElement('canvas');
            const pad = 20; 
            const cellSize = Math.max(10, state.cellSize);
            tCanvas.width = (w * cellSize) + pad*2;
            tCanvas.height = (h * cellSize) + pad*2;
            const tCtx = tCanvas.getContext('2d');

            tCtx.fillStyle = "white";
            tCtx.fillRect(0, 0, tCanvas.width, tCanvas.height);
            tCtx.translate(pad, pad);
            
            // Draw Section
            for(let sy = 0; sy < h; sy++) {
                for(let sx = 0; sx < w; sx++) {
                     const color = state.gridData[y + sy][x + sx];
                     if(color) {
                         tCtx.fillStyle = color;
                         tCtx.fillRect(sx*cellSize, sy*cellSize, cellSize, cellSize);
                     }
                     tCtx.strokeStyle = "#ddd";
                     tCtx.lineWidth = 1;
                     tCtx.strokeRect(sx*cellSize, sy*cellSize, cellSize, cellSize);
                }
            }

            const colStart = state.cols - x;
            const colEnd = state.cols - (x + w - 1);
            const rowStart = state.rows - y;
            const rowEnd = state.rows - (y + h - 1);

            tCtx.fillStyle = "black";
            tCtx.font = "14px sans-serif";
            tCtx.fillText(`Cols: ${colStart}-${colEnd}`, 0, -5);
            tCtx.fillText(`Rows: ${rowStart}-${rowEnd}`, -5, 0);

            win.document.write(`<div class="section"><h3>Cols ${colStart}-${colEnd}, Rows ${rowStart}-${rowEnd}</h3><img src="${tCanvas.toDataURL()}"></div>`);
        }
    }
    win.document.write('</body></html>');
    win.document.close();
}

function saveProject() {
    if (!state.gridData.length) return;

    const dataToSave = {
        gridData: state.gridData,
        cols: state.cols,
        rows: state.rows,
        density: state.density,
    };

    const jsonString = JSON.stringify(dataToSave);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `stitch-pattern-${state.cols}x${state.rows}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    els.statusText.textContent = "Project saved";
}

function loadProject(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Basic validation
            if (!data.gridData || !data.cols || !data.rows) {
                throw new Error("Invalid project file format.");
            }

            state.gridData = data.gridData;
            state.cols = data.cols;
            state.rows = data.rows;
            state.density = data.density || 55;
            
            // Update UI controls
            els.widthNum.value = state.cols;
            els.heightNum.value = state.rows;
            els.densityInput.value = state.density;

            // Clear image preview as we are loading a project
            els.sourcePreview.classList.add('hidden');
            if (state.imageUrl) {
                URL.revokeObjectURL(state.imageUrl);
                state.imageUrl = null;
                state.imageObj = null;
            }

            const paletteSet = new Set(state.gridData.flat().filter(c => c));
            updatePaletteDisplay(Array.from(paletteSet));

            // Reset zoom and cell size before rendering
            state.zoom = 1;
            state.baseCellSize = 15; // Or recalculate? Let's stick with a default for now.
            state.cellSize = state.baseCellSize * state.zoom;
            els.zoomLevel.textContent = '100%';


            resizeCanvas();
            render();

            els.emptyState.style.display = 'none';
            els.exportBtn.disabled = false;
            els.exportSectionsBtn.disabled = false;
            els.saveBtn.disabled = false;
            els.statusText.textContent = `Loaded project ${state.cols}x${state.rows}`;

        } catch (err) {
            console.error(err);
            alert("Error loading project: " + err.message);
        }
    };
    reader.readAsText(file);
}

init();
