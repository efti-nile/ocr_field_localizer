// Application state
let images = [];
let currentImageIndex = 0;
let currentData = null;
let selectedField = null;
let img = new Image();
let canvas, ctx;
let progress = { viewed: [], updated: [] };

// Zoom and pan state
let zoomLevel = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Color palette for fields
const FIELD_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
    '#FF8FAB', '#06FFA5', '#FFD93D', '#6BCF7F', '#A8DADC'
];

const OCR_COLOR = '#95A5A6'; // Neutral gray for OCR boxes

// Initialize the application
async function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    // Load images list
    await loadImagesList();
    
    // Set up event listeners
    document.getElementById('prevBtn').addEventListener('click', () => navigateImage(-1));
    document.getElementById('nextBtn').addEventListener('click', () => navigateImage(1));
    document.getElementById('saveBtn').addEventListener('click', saveData);
    document.getElementById('resetFieldBtn').addEventListener('click', resetCurrentField);
    document.getElementById('imageSelect').addEventListener('change', (e) => {
        currentImageIndex = parseInt(e.target.value);
        loadImage(currentImageIndex);
    });
    
    canvas.addEventListener('click', handleCanvasClick);
    
    // Add zoom and pan event listeners
    canvas.addEventListener('wheel', handleZoom);
    canvas.addEventListener('mousedown', handlePanStart);
    canvas.addEventListener('mousemove', handlePanMove);
    canvas.addEventListener('mouseup', handlePanEnd);
    canvas.addEventListener('mouseleave', handlePanEnd);
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Load first image
    if (images.length > 0) {
        loadImage(0);
    }
}

// Load list of images from server
async function loadImagesList() {
    try {
        const response = await fetch('/api/images');
        images = await response.json();
        
        // Load progress data
        const progressResponse = await fetch('/api/progress');
        progress = await progressResponse.json();
        
        // Populate image selector with status indicators
        const select = document.getElementById('imageSelect');
        select.innerHTML = images.map((img, idx) => {
            const status = getImageStatus(img.id);
            const statusIcon = status === 'updated' ? '✓' : status === 'viewed' ? '👁' : '○';
            return `<option value="${idx}">${statusIcon} ${img.imagePath}</option>`;
        }).join('');
        
    } catch (error) {
        console.error('Error loading images:', error);
        alert('Error loading images. Make sure the data folder exists and contains images.');
    }
}

// Get image status
function getImageStatus(imgId) {
    if (progress.updated.includes(imgId)) return 'updated';
    if (progress.viewed.includes(imgId)) return 'viewed';
    return 'unviewed';
}

// Load specific image and its data
async function loadImage(index) {
    if (index < 0 || index >= images.length) return;
    
    currentImageIndex = index;
    const imageInfo = images[index];
    
    try {
        // Load JSON data
        const dataResponse = await fetch(`/api/data/${imageInfo.id}`);
        currentData = await dataResponse.json();
        
        // Load image
        img.src = `/api/image/${imageInfo.id}`;
        img.onload = () => {
            // Set canvas size to match image
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Reset zoom and pan
            zoomLevel = 1.0;
            panX = 0;
            panY = 0;
            
            // Draw everything
            drawImage();
            
            // Update UI
            updateUI();
        };
        
        // Mark image as viewed
        markAsViewed(imageInfo.id);
        
    } catch (error) {
        console.error('Error loading image:', error);
        alert('Error loading image data.');
    }
}

// Mark image as viewed
async function markAsViewed(imgId) {
    try {
        await fetch(`/api/progress/viewed/${imgId}`, { method: 'POST' });
        if (!progress.viewed.includes(imgId)) {
            progress.viewed.push(imgId);
        }
        updateImageSelector();
    } catch (error) {
        console.error('Error marking image as viewed:', error);
    }
}

// Update image selector with status
function updateImageSelector() {
    const select = document.getElementById('imageSelect');
    select.innerHTML = images.map((img, idx) => {
        const status = getImageStatus(img.id);
        const statusIcon = status === 'updated' ? '✓' : status === 'viewed' ? '👁' : '○';
        return `<option value="${idx}">${statusIcon} ${img.imagePath}</option>`;
    }).join('');
    select.value = currentImageIndex;
}

// Draw image and all boxes
function drawImage() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context state
    ctx.save();
    
    // Apply zoom and pan transformations
    ctx.translate(panX, panY);
    ctx.scale(zoomLevel, zoomLevel);
    
    // Draw image
    ctx.drawImage(img, 0, 0);
    
    // Draw OCR boxes (neutral color)
    if (currentData.ocr) {
        currentData.ocr.forEach(box => {
            drawBox(box, OCR_COLOR, 4);
        });
    }
    
    // Draw field boxes (bright colors)
    if (currentData.fields) {
        const fieldNames = Object.keys(currentData.fields);
        fieldNames.forEach((fieldName, idx) => {
            const box = currentData.fields[fieldName];
            const color = FIELD_COLORS[idx % FIELD_COLORS.length];
            
            // Each field has only one box (not an array)
            if (box && box.length === 4) {
                drawBox(box, color, 5);
                drawLabel(box, fieldName, color);
            }
        });
    }
    
    // Restore context state
    ctx.restore();
}

// Draw a single box
function drawBox(box, color, lineWidth) {
    if (!box || box.length !== 4) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(box[0][0], box[0][1]);
    ctx.lineTo(box[1][0], box[1][1]);
    ctx.lineTo(box[2][0], box[2][1]);
    ctx.lineTo(box[3][0], box[3][1]);
    ctx.closePath();
    ctx.stroke();
}

// Draw a label for a field box
function drawLabel(box, fieldName, color) {
    if (!box || box.length !== 4) return;
    
    // Position label at the top-left corner of the box
    const x = box[0][0];
    const y = box[0][1];
    
    // Set font size relative to image height (2.5% of image height)
    const fontSize = Math.max(12, img.height * 0.025);
    ctx.font = `bold ${fontSize}px Arial`;
    const textMetrics = ctx.measureText(fieldName);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2;
    
    // Draw background rectangle
    const padding = 6;
    ctx.fillStyle = color;
    ctx.fillRect(x, y - textHeight - padding, textWidth + padding * 2, textHeight + padding);
    
    // Draw text
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.fillText(fieldName, x + padding, y - textHeight - padding / 2);
}

// Update UI elements
function updateUI() {
    // Update image counter
    document.getElementById('imageCounter').textContent = `Image ${currentImageIndex + 1} of ${images.length}`;
    
    // Update image path
    document.getElementById('imagePath').textContent = images[currentImageIndex].imagePath;
    
    // Update image status
    const currentImgId = images[currentImageIndex].id;
    const status = getImageStatus(currentImgId);
    const statusText = status === 'updated' ? '✓ Updated' : status === 'viewed' ? '👁 Viewed' : '○ Not viewed';
    const statusEl = document.getElementById('imageStatus');
    statusEl.textContent = `Status: ${statusText}`;
    statusEl.style.background = status === 'updated' ? '#d4edda' : status === 'viewed' ? '#fff3cd' : '#f8d7da';
    statusEl.style.color = status === 'updated' ? '#155724' : status === 'viewed' ? '#856404' : '#721c24';
    
    // Update progress statistics
    const unviewedCount = images.length - progress.viewed.length;
    const viewedCount = progress.viewed.length - progress.updated.length;
    const updatedCount = progress.updated.length;
    document.getElementById('unviewedCount').textContent = unviewedCount;
    document.getElementById('viewedCount').textContent = viewedCount;
    document.getElementById('updatedCount').textContent = updatedCount;
    
    // Update image selector
    document.getElementById('imageSelect').value = currentImageIndex;
    
    // Update navigation buttons
    document.getElementById('prevBtn').disabled = currentImageIndex === 0;
    document.getElementById('nextBtn').disabled = currentImageIndex === images.length - 1;
    
    // Update reset button state
    document.getElementById('resetFieldBtn').disabled = !selectedField;
    
    // Update field selector
    updateFieldSelector();
}

// Update field selector panel
function updateFieldSelector() {
    const fieldSelector = document.getElementById('fieldSelector');
    
    if (!currentData.fields) {
        currentData.fields = {};
    }
    
    const fieldNames = Object.keys(currentData.fields);
    
    if (fieldNames.length === 0) {
        fieldSelector.innerHTML = '<p style="color: #999; font-size: 14px;">No fields defined in JSON</p>';
        return;
    }
    
    fieldSelector.innerHTML = fieldNames.map((fieldName, idx) => {
        const color = FIELD_COLORS[idx % FIELD_COLORS.length];
        const isSelected = selectedField === fieldName;
        return `
            <div class="field-item ${isSelected ? 'selected' : ''}" data-field="${fieldName}">
                <div class="field-color" style="background-color: ${color}"></div>
                <span>${fieldName}</span>
            </div>
        `;
    }).join('');
    
    // Add click listeners to field items
    document.querySelectorAll('.field-item').forEach(item => {
        item.addEventListener('click', () => {
            selectedField = item.dataset.field;
            updateFieldSelector();
            // Update reset button state
            document.getElementById('resetFieldBtn').disabled = false;
        });
    });
}

// Handle canvas click
function handleCanvasClick(event) {
    if (!selectedField) {
        alert('Please select a field first!');
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;
    
    // Transform canvas coordinates to image coordinates (account for zoom and pan)
    const x = (canvasX - panX) / zoomLevel;
    const y = (canvasY - panY) / zoomLevel;
    
    // Check if click is inside any OCR box
    const clickedBox = findBoxAtPoint(x, y, currentData.ocr);
    
    if (clickedBox) {
        // Remove box from any existing field
        removeBoxFromAllFields(clickedBox);
        
        // Assign the box to the selected field (replace any existing box)
        currentData.fields[selectedField] = clickedBox;
        
        // Redraw
        drawImage();
    }
}

// Find box at specific point
function findBoxAtPoint(x, y, boxes) {
    if (!boxes) return null;
    
    for (const box of boxes) {
        if (isPointInBox(x, y, box)) {
            return box;
        }
    }
    return null;
}

// Check if point is inside a box (polygon)
function isPointInBox(x, y, box) {
    if (!box || box.length !== 4) return false;
    
    // Use ray casting algorithm
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
        const xi = box[i][0], yi = box[i][1];
        const xj = box[j][0], yj = box[j][1];
        
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Remove box from all fields
function removeBoxFromAllFields(box) {
    if (!currentData.fields) return;
    
    Object.keys(currentData.fields).forEach(fieldName => {
        const fieldBox = currentData.fields[fieldName];
        
        // Each field has only one box, so just check if it matches
        if (boxesEqual(fieldBox, box)) {
            // Set to null instead of deleting to preserve the field
            currentData.fields[fieldName] = null;
        }
    });
}

// Check if two boxes are equal
function boxesEqual(box1, box2) {
    if (!box1 || !box2 || box1.length !== 4 || box2.length !== 4) return false;
    
    for (let i = 0; i < 4; i++) {
        if (box1[i][0] !== box2[i][0] || box1[i][1] !== box2[i][1]) {
            return false;
        }
    }
    return true;
}

// Reset the current selected field
function resetCurrentField() {
    if (!selectedField) {
        alert('Please select a field first!');
        return;
    }
    
    // Set the field's box to null
    currentData.fields[selectedField] = null;
    
    // Redraw the image
    drawImage();
}

// Navigate to next/previous image
function navigateImage(direction) {
    const newIndex = currentImageIndex + direction;
    if (newIndex >= 0 && newIndex < images.length) {
        loadImage(newIndex);
    }
}

// Handle zoom with mouse wheel
function handleZoom(event) {
    event.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    // Calculate zoom factor
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, zoomLevel * zoomFactor));
    
    // Adjust pan to zoom towards mouse position
    const zoomRatio = newZoom / zoomLevel;
    panX = mouseX - (mouseX - panX) * zoomRatio;
    panY = mouseY - (mouseY - panY) * zoomRatio;
    
    zoomLevel = newZoom;
    drawImage();
}

// Handle pan start (middle mouse button or space + left click)
function handlePanStart(event) {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
        event.preventDefault();
        isPanning = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        canvas.style.cursor = 'grabbing';
    }
}

// Handle pan move
function handlePanMove(event) {
    if (isPanning) {
        const dx = event.clientX - lastMouseX;
        const dy = event.clientY - lastMouseY;
        
        panX += dx;
        panY += dy;
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        
        drawImage();
    }
}

// Handle pan end
function handlePanEnd(event) {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'crosshair';
    }
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(event) {
    // Ctrl+Left Arrow - Previous image
    if (event.ctrlKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateImage(-1);
    }
    
    // Ctrl+Right Arrow - Next image
    if (event.ctrlKey && event.key === 'ArrowRight') {
        event.preventDefault();
        navigateImage(1);
    }
    
    // Ctrl+S - Save changes
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveData();
    }
    
    // Ctrl+0 - Reset zoom
    if (event.ctrlKey && event.key === '0') {
        event.preventDefault();
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        drawImage();
    }
}

// Save data to server
async function saveData() {
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    
    try {
        // Visual feedback - change button text
        saveBtn.textContent = '💾 Saving...';
        saveBtn.disabled = true;
        
        const imageInfo = images[currentImageIndex];
        const response = await fetch(`/api/data/${imageInfo.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success feedback briefly
            saveBtn.textContent = '✓ Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 1000);
        } else {
            saveBtn.textContent = '✗ Error';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 2000);
            console.error('Error saving changes.');
        }
    } catch (error) {
        console.error('Error saving data:', error);
        saveBtn.textContent = '✗ Error';
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }, 2000);
    }
}

// Initialize app when page loads
window.addEventListener('load', init);
