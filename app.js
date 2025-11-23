// Zoo Planner App - Vanilla JavaScript
// No build tools, no frameworks, just fun!

const GRID_SIZE = 30; // Grid is 30x30 squares
const CELL_SIZE = 20; // Each square is 20px

// Building definitions - loaded from JSON
let BUILDINGS = [];

// Animal definitions - loaded from JSON
let ANIMALS = [];

// App state
const state = {
    selectedAnimal: null, // Currently selected animal to draw
    placedBuildings: [],
    enclosures: [],
    drawing: null,
    draggingBuilding: null, // Building being dragged from palette
    movingItem: null, // Item being moved on grid
    moveStartPos: null, // Starting position for distinguishing click vs drag
    nextEnclosureId: 1,
    zooName: '', // Name of the zoo
};

// Check if a rectangle overlaps with any existing buildings or enclosures
function checkOverlap(gridX, gridY, width, height, excludeId = null) {
    // Check buildings
    for (const building of state.placedBuildings) {
        if (building.id === excludeId) continue;
        
        if (!(gridX + width <= building.gridX ||
              gridX >= building.gridX + building.width ||
              gridY + height <= building.gridY ||
              gridY >= building.gridY + building.height)) {
            return true; // Overlap detected
        }
    }
    
    // Check enclosures
    for (const enclosure of state.enclosures) {
        if (enclosure.id === excludeId) continue;
        
        if (!(gridX + width <= enclosure.gridX ||
              gridX >= enclosure.gridX + enclosure.width ||
              gridY + height <= enclosure.gridY ||
              gridY >= enclosure.gridY + enclosure.height)) {
            return true; // Overlap detected
        }
    }
    
    return false; // No overlap
}

// Load animals from JSON file
async function loadAnimals() {
    try {
        const response = await fetch('animals.json');
        const animalsData = await response.json();
        
        // Convert to app format with id field
        ANIMALS = animalsData.map(animal => ({
            id: animal.name.toLowerCase(),
            name: animal.name,
            emoji: animal.emoji,
            minPerimeter: animal.minPerimeter,
            minArea: animal.minArea
        }));
        
        return true;
    } catch (error) {
        console.error('Error loading animals:', error);
        return false;
    }
}

// Load buildings from JSON file
async function loadBuildings() {
    try {
        const response = await fetch('buildings.json');
        const buildingsData = await response.json();
        
        // Convert to app format with id field
        BUILDINGS = buildingsData.map(building => ({
            id: building.name.toLowerCase().replace(/\s+/g, ''),
            name: building.name,
            emoji: building.emoji,
            width: building.width,
            height: building.height,
            color: building.color
        }));
        
        return true;
    } catch (error) {
        console.error('Error loading buildings:', error);
        return false;
    }
}

// Initialize the app
async function init() {
    // Load data files first
    const [animalsLoaded, buildingsLoaded] = await Promise.all([
        loadAnimals(),
        loadBuildings()
    ]);
    
    if (!animalsLoaded || !buildingsLoaded) {
        alert('Error loading zoo data. Please refresh the page.');
        return;
    }
    
    setupGrid();
    setupBuildingsPalette();
    setupAnimalList();
    setupToolButtons();
    setupEventListeners();
    setupZooName();
    updateSummaryTable();
}

// Update the summary table with all enclosures
function updateSummaryTable() {
    const tbody = document.getElementById('summaryBody');
    
    if (state.enclosures.length === 0) {
        tbody.innerHTML = '<tr class="empty-state"><td colspan="3">No enclosures yet - draw some animals!</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    state.enclosures.forEach(enclosure => {
        const animal = ANIMALS.find(a => a.id === enclosure.animal);
        if (!animal) return;
        
        const area = enclosure.width * enclosure.height;
        const perimeter = 2 * (enclosure.width + enclosure.height);
        
        const areaTooSmall = area < animal.minArea;
        const perimeterTooSmall = perimeter < animal.minPerimeter;
        const needsWarning = areaTooSmall || perimeterTooSmall;
        
        const row = document.createElement('tr');
        if (needsWarning) {
            row.classList.add('warning-row');
        }
        
        row.innerHTML = `
            <td>
                <div class="animal-cell">
                    <span class="animal-emoji">${animal.emoji}</span>
                    <div>
                        <div>${animal.name}</div>
                        <small class="dimensions-text">${enclosure.width} × ${enclosure.height}</small>
                    </div>
                </div>
            </td>
            <td class="perimeter-cell ${perimeterTooSmall ? 'too-small' : ''}">${perimeter} ${perimeterTooSmall ? '⚠️' : ''}</td>
            <td class="area-cell ${areaTooSmall ? 'too-small' : ''}">${area} ${areaTooSmall ? '⚠️' : ''}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Setup zoo name input
function setupZooName() {
    const zooNameInput = document.getElementById('zooName');
    
    // Select all text when focused
    zooNameInput.addEventListener('focus', () => {
        zooNameInput.select();
    });
    
    // Update document title when name changes
    zooNameInput.addEventListener('input', () => {
        const name = zooNameInput.value.trim();
        if (name) {
            document.title = `${name} - Zoo Planner`;
        } else {
            document.title = 'Zoo Planner - Design Your Zoo!';
        }
    });
    
    // Save to state when changed
    zooNameInput.addEventListener('change', () => {
        state.zooName = zooNameInput.value.trim();
    });
}

// Create the SVG grid
function setupGrid() {
    const svg = document.getElementById('zooGrid');
    const width = GRID_SIZE * CELL_SIZE;
    const height = GRID_SIZE * CELL_SIZE;
    
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // Create grid group
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.id = 'gridLines';
    
    // Draw vertical lines
    for (let i = 0; i <= GRID_SIZE; i++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', i * CELL_SIZE);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', i * CELL_SIZE);
        line.setAttribute('y2', height);
        line.setAttribute('class', 'grid-line');
        gridGroup.appendChild(line);
    }
    
    // Draw horizontal lines
    for (let i = 0; i <= GRID_SIZE; i++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', i * CELL_SIZE);
        line.setAttribute('x2', width);
        line.setAttribute('y2', i * CELL_SIZE);
        line.setAttribute('class', 'grid-line');
        gridGroup.appendChild(line);
    }
    
    svg.appendChild(gridGroup);
    
    // Create groups for items (enclosures and buildings)
    const enclosuresGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    enclosuresGroup.id = 'enclosures';
    svg.appendChild(enclosuresGroup);
    
    const buildingsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    buildingsGroup.id = 'buildings';
    svg.appendChild(buildingsGroup);
}

// Populate the buildings palette
function setupBuildingsPalette() {
    renderBuildingList();
}

// Render the building list with current state
function renderBuildingList() {
    const buildingList = document.getElementById('buildingList');
    buildingList.innerHTML = '';
    
    // Check which buildings are already placed
    const usedBuildings = new Set(state.placedBuildings.map(b => b.id.split('-')[0])); // Extract building type
    
    BUILDINGS.forEach(building => {
        const isUsed = Array.from(usedBuildings).some(used => used.includes(building.id));
        
        const div = document.createElement('div');
        div.className = 'building-item';
        div.dataset.buildingId = building.id;
        
        if (isUsed) {
            div.classList.add('used');
        } else {
            div.draggable = true;
            // Drag from palette to grid
            div.addEventListener('dragstart', handlePaletteDragStart);
            div.addEventListener('dragend', handlePaletteDragEnd);
        }
        
        div.innerHTML = `
            <span class="building-emoji">${building.emoji}</span>
            <div class="building-info">
                <div class="building-name">${building.name}</div>
                <span class="building-size">${building.width}×${building.height} squares</span>
            </div>
            ${isUsed ? '<button class="delete-building-btn" title="Delete this building">🗑️</button>' : ''}
        `;
        
        // Delete button handler
        if (isUsed) {
            const deleteBtn = div.querySelector('.delete-building-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBuildingByType(building.id);
            });
        }
        
        buildingList.appendChild(div);
    });
}

// Populate the animal list
function setupAnimalList() {
    renderAnimalList();
}

// Render the animal list with current state
function renderAnimalList() {
    const animalList = document.getElementById('animalList');
    animalList.innerHTML = '';
    
    // Check which animals are already used
    const usedAnimals = new Set(state.enclosures.map(e => e.animal));
    
    ANIMALS.forEach((animal, index) => {
        const isUsed = usedAnimals.has(animal.id);
        
        const card = document.createElement('div');
        card.className = 'animal-card';
        card.dataset.animalId = animal.id;
        
        if (isUsed) {
            card.classList.add('used');
        }
        
        card.innerHTML = `
            <span class="emoji">${animal.emoji}</span>
            <div class="animal-info">
                <strong>${animal.name}</strong>
                <small>Min Area: ${animal.minArea}</small>
                <small>Min Perimeter: ${animal.minPerimeter}</small>
            </div>
            ${isUsed ? '<button class="delete-animal-btn" title="Delete this enclosure">🗑️</button>' : ''}
        `;
        
        // Click to select (only if not used)
        if (!isUsed) {
            card.addEventListener('click', () => selectAnimal(animal.id));
        }
        
        // Delete button handler
        if (isUsed) {
            const deleteBtn = card.querySelector('.delete-animal-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteEnclosureByAnimal(animal.id);
            });
        }
        
        animalList.appendChild(card);
        
        // Select first available animal by default
        if (index === 0 && !state.selectedAnimal) {
            selectAnimal(animal.id);
        }
    });
    
    // If currently selected animal is now used, select first available
    if (usedAnimals.has(state.selectedAnimal)) {
        const firstAvailable = ANIMALS.find(a => !usedAnimals.has(a.id));
        if (firstAvailable) {
            selectAnimal(firstAvailable.id);
        } else {
            state.selectedAnimal = null;
        }
    }
}

// Select an animal for drawing
function selectAnimal(animalId) {
    // Don't select if already used
    const usedAnimals = new Set(state.enclosures.map(e => e.animal));
    if (usedAnimals.has(animalId)) {
        return;
    }
    
    state.selectedAnimal = animalId;
    
    // Update visual state
    document.querySelectorAll('.animal-card').forEach(card => {
        if (card.dataset.animalId === animalId) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

// Setup tool button handlers
function setupToolButtons() {
    document.getElementById('startOver').addEventListener('click', startOver);
}

// Setup event listeners for the grid
function setupEventListeners() {
    const svg = document.getElementById('zooGrid');
    
    // Drop handler for buildings from palette
    svg.addEventListener('dragover', handleGridDragOver);
    svg.addEventListener('dragleave', handleGridDragLeave);
    svg.addEventListener('drop', handleGridDrop);
    
    // Mouse handlers for drawing enclosures and moving items
    svg.addEventListener('mousedown', handleGridMouseDown);
    svg.addEventListener('mousemove', handleGridMouseMove);
    
    // Listen for mouseup at document level to catch events outside the SVG
    document.addEventListener('mouseup', handleGridMouseUp);
    
    // Also handle when mouse leaves the SVG while dragging
    svg.addEventListener('mouseleave', handleGridMouseLeave);
    
    // Touch support
    svg.addEventListener('touchstart', handleGridTouchStart, { passive: false });
    svg.addEventListener('touchmove', handleGridTouchMove, { passive: false });
    svg.addEventListener('touchend', handleGridTouchEnd, { passive: false });
}

// Drag from palette
function handlePaletteDragStart(e) {
    const buildingId = e.target.closest('.building-item').dataset.buildingId;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('buildingId', buildingId);
    
    // Store the building being dragged
    const building = BUILDINGS.find(b => b.id === buildingId);
    state.draggingBuilding = building;
    
    // Make the drag image mostly transparent
    const dragItem = e.target.closest('.building-item');
    dragItem.classList.add('dragging');
    
    // Create a mostly invisible drag image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
}

// Clean up when drag ends
function handlePaletteDragEnd(e) {
    removeBuildingPreview();
    state.draggingBuilding = null;
    
    const dragItem = e.target.closest('.building-item');
    if (dragItem) {
        dragItem.classList.remove('dragging');
    }
}

// Show preview when dragging over grid
function handleGridDragOver(e) {
    e.preventDefault();
    
    if (!state.draggingBuilding) return;
    
    const svg = document.getElementById('zooGrid');
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Snap to grid
    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);
    
    renderBuildingPreview(state.draggingBuilding, gridX, gridY);
}

// Remove preview when leaving grid
function handleGridDragLeave(e) {
    // Only remove if we're actually leaving the SVG
    if (e.target.id === 'zooGrid') {
        removeBuildingPreview();
    }
}

// Render building preview
function renderBuildingPreview(building, gridX, gridY) {
    let preview = document.getElementById('buildingPreview');
    
    if (!preview) {
        preview = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        preview.id = 'buildingPreview';
        preview.classList.add('building-preview');
        document.getElementById('buildings').appendChild(preview);
    }
    
    const x = gridX * CELL_SIZE;
    const y = gridY * CELL_SIZE;
    const width = building.width * CELL_SIZE;
    const height = building.height * CELL_SIZE;
    
    // Check if it fits within grid and doesn't overlap
    const fitsInGrid = gridX + building.width <= GRID_SIZE && gridY + building.height <= GRID_SIZE;
    const hasOverlap = checkOverlap(gridX, gridY, building.width, building.height);
    const canPlace = fitsInGrid && !hasOverlap;
    
    preview.setAttribute('x', x);
    preview.setAttribute('y', y);
    preview.setAttribute('width', width);
    preview.setAttribute('height', height);
    preview.setAttribute('fill', building.color);
    preview.setAttribute('opacity', canPlace ? '0.5' : '0.3');
    preview.setAttribute('stroke', canPlace ? '#4caf50' : '#f5576c');
    preview.setAttribute('stroke-width', '3');
    preview.setAttribute('stroke-dasharray', '5,5');
    preview.setAttribute('rx', '5');
}

// Remove building preview
function removeBuildingPreview() {
    const preview = document.getElementById('buildingPreview');
    if (preview) preview.remove();
}

// Drop building on grid
function handleGridDrop(e) {
    e.preventDefault();
    
    // Remove preview
    removeBuildingPreview();
    
    const buildingId = e.dataTransfer.getData('buildingId');
    if (!buildingId) return;
    
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return;
    
    // Check if this building type is already placed
    const alreadyPlaced = state.placedBuildings.some(b => b.id.includes(building.id));
    if (alreadyPlaced) {
        state.draggingBuilding = null;
        return;
    }
    
    const svg = document.getElementById('zooGrid');
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Snap to grid
    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);
    
    // Check if it fits and doesn't overlap
    const fitsInGrid = gridX + building.width <= GRID_SIZE && gridY + building.height <= GRID_SIZE;
    const hasOverlap = checkOverlap(gridX, gridY, building.width, building.height);
    
    if (fitsInGrid && !hasOverlap) {
        addBuilding(building, gridX, gridY);
    }
    
    // Clear dragging state
    state.draggingBuilding = null;
}

// Add a building to the grid
function addBuilding(buildingDef, gridX, gridY) {
    const id = `${buildingDef.id}-${Date.now()}`;
    const building = {
        id,
        ...buildingDef,
        gridX,
        gridY,
    };
    
    state.placedBuildings.push(building);
    renderBuilding(building);
    
    // Update building list to show this building as used
    renderBuildingList();
}

// Render a building on the SVG
function renderBuilding(building) {
    // Remove existing if re-rendering
    const existing = document.getElementById(building.id);
    if (existing) existing.remove();
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = building.id;
    group.classList.add('building');
    group.dataset.buildingId = building.id;
    
    const x = building.gridX * CELL_SIZE;
    const y = building.gridY * CELL_SIZE;
    const width = building.width * CELL_SIZE;
    const height = building.height * CELL_SIZE;
    
    // Check if position is valid
    const fitsInGrid = building.gridX >= 0 && building.gridY >= 0 &&
                       building.gridX + building.width <= GRID_SIZE &&
                       building.gridY + building.height <= GRID_SIZE;
    const hasOverlap = checkOverlap(building.gridX, building.gridY, building.width, building.height, building.id);
    const isValid = fitsInGrid && !hasOverlap;
    
    // Building rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', building.color);
    rect.setAttribute('stroke', '#333');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('rx', '5');
    rect.classList.add('building-rect');
    
    if (!isValid) {
        rect.classList.add('building-invalid');
    }
    
    group.appendChild(rect);
    
    // Emoji
    const emoji = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emoji.setAttribute('x', x + width / 2);
    emoji.setAttribute('y', y + height / 2 - 5);
    emoji.setAttribute('class', 'building-label');
    emoji.setAttribute('font-size', Math.min(width, height) * 0.4);
    emoji.textContent = building.emoji;
    group.appendChild(emoji);
    
    // Name
    const name = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    name.setAttribute('x', x + width / 2);
    name.setAttribute('y', y + height / 2 + 12);
    name.setAttribute('class', 'building-label');
    name.setAttribute('font-size', '10');
    name.textContent = building.name;
    group.appendChild(name);
    
    document.getElementById('buildings').appendChild(group);
}

// Grid interaction - Drawing enclosures or moving items
function handleGridMouseDown(e) {
    const point = getGridPoint(e);
    
    // Check if clicking on an existing enclosure
    const enclosureEl = e.target.closest('.enclosure');
    if (enclosureEl) {
        const id = enclosureEl.closest('g').dataset.enclosureId;
        const enclosure = state.enclosures.find(enc => enc.id === id);
        if (enclosure) {
            // Store enclosure for potential delete dialog
            enclosure._forDelete = true;
            // Start moving
            state.movingItem = {
                type: 'enclosure',
                id: id,
                data: enclosure,
                originalX: enclosure.gridX,
                originalY: enclosure.gridY,
                offsetX: point.gridX - enclosure.gridX,
                offsetY: point.gridY - enclosure.gridY,
            };
            state.moveStartPos = { x: e.clientX, y: e.clientY };
        }
        return;
    }
    
    // Check if clicking on a building
    const buildingEl = e.target.closest('.building');
    if (buildingEl) {
        const id = buildingEl.closest('g').dataset.buildingId;
        const building = state.placedBuildings.find(b => b.id === id);
        if (building) {
            // Start moving
            state.movingItem = {
                type: 'building',
                id: id,
                data: building,
                originalX: building.gridX,
                originalY: building.gridY,
                offsetX: point.gridX - building.gridX,
                offsetY: point.gridY - building.gridY,
            };
            state.moveStartPos = { x: e.clientX, y: e.clientY };
        }
        return;
    }
    
    // Must have an animal selected to draw
    if (!state.selectedAnimal) return;
    
    state.drawing = {
        startX: point.gridX,
        startY: point.gridY,
        currentX: point.gridX,
        currentY: point.gridY,
    };
    
    renderDrawingEnclosure();
}

function handleGridMouseMove(e) {
    // Handle moving an existing item
    if (state.movingItem) {
        // Only update if mouse is near the grid
        const svg = document.getElementById('zooGrid');
        const rect = svg.getBoundingClientRect();
        
        // Check if mouse is reasonably close to the SVG
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const isNearSVG = mouseX >= rect.left - 50 && mouseX <= rect.right + 50 &&
                          mouseY >= rect.top - 50 && mouseY <= rect.bottom + 50;
        
        if (!isNearSVG) {
            // Don't update position if too far from grid
            return;
        }
        
        const point = getGridPoint(e);
        let newX = point.gridX - state.movingItem.offsetX;
        let newY = point.gridY - state.movingItem.offsetY;
        
        // Get dimensions
        const width = state.movingItem.data.width;
        const height = state.movingItem.data.height;
        
        // Constrain to grid boundaries
        newX = Math.max(0, Math.min(newX, GRID_SIZE - width));
        newY = Math.max(0, Math.min(newY, GRID_SIZE - height));
        
        // Update position
        state.movingItem.data.gridX = newX;
        state.movingItem.data.gridY = newY;
        
        // Re-render
        if (state.movingItem.type === 'enclosure') {
            renderEnclosure(state.movingItem.data);
        } else {
            renderBuilding(state.movingItem.data);
        }
        return;
    }
    
    // Handle drawing new enclosure
    if (!state.drawing) return;
    
    const point = getGridPoint(e);
    state.drawing.currentX = point.gridX;
    state.drawing.currentY = point.gridY;
    
    renderDrawingEnclosure();
}

function handleGridMouseUp(e) {
    // Handle finishing a move
    if (state.movingItem) {
        // Calculate distance moved from original mouse position
        const distanceMoved = state.moveStartPos ? Math.sqrt(
            Math.pow(e.clientX - state.moveStartPos.x, 2) +
            Math.pow(e.clientY - state.moveStartPos.y, 2)
        ) : 100; // Default to large distance if no start pos
        
        // If barely moved (< 5 pixels), treat as click for delete
        if (distanceMoved < 5) {
            const item = state.movingItem;
            // Restore original position first
            item.data.gridX = item.originalX;
            item.data.gridY = item.originalY;
            
            if (item.type === 'enclosure') {
                renderEnclosure(item.data);
                const animal = ANIMALS.find(a => a.id === item.data.animal);
                const emoji = animal ? animal.emoji : '🦁';
                const name = animal ? animal.name : 'Enclosure';
                showConfirmDialog('Delete this enclosure?', () => {
                    deleteEnclosure(item.id);
                }, emoji, name);
            } else {
                renderBuilding(item.data);
                showConfirmDialog('Delete this building?', () => {
                    deleteBuilding(item.id);
                }, item.data.emoji, item.data.name);
            }
            
            state.movingItem = null;
            state.moveStartPos = null;
            return;
        }
        
        // Validate final position
        const item = state.movingItem.data;
        const width = state.movingItem.type === 'enclosure' ? item.width : item.width;
        const height = state.movingItem.type === 'enclosure' ? item.height : item.height;
        
        const fitsInGrid = item.gridX >= 0 && item.gridY >= 0 &&
                          item.gridX + width <= GRID_SIZE &&
                          item.gridY + height <= GRID_SIZE;
        
        const hasOverlap = checkOverlap(item.gridX, item.gridY, width, height, state.movingItem.id);
        
        if (!fitsInGrid || hasOverlap) {
            // Revert to original position
            item.gridX = state.movingItem.originalX;
            item.gridY = state.movingItem.originalY;
        }
        
        // Re-render at final position
        if (state.movingItem.type === 'enclosure') {
            renderEnclosure(item);
        } else {
            renderBuilding(item);
        }
        
        state.movingItem = null;
        state.moveStartPos = null;
        return;
    }
    
    // Handle finishing drawing
    if (!state.drawing) return;
    
    const { startX, startY, currentX, currentY } = state.drawing;
    
    // Calculate rectangle
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX) + 1;
    const height = Math.abs(currentY - startY) + 1;
    
    // Check for overlap
    const hasOverlap = checkOverlap(x, y, width, height);
    
    // Only create if it has some size and doesn't overlap
    if (width > 0 && height > 0 && !hasOverlap) {
        addEnclosure(x, y, width, height);
    }
    
    // Clean up
    const temp = document.getElementById('tempEnclosure');
    if (temp) temp.remove();
    const tempLabel = document.getElementById('tempEnclosureLabel');
    if (tempLabel) tempLabel.remove();
    state.drawing = null;
}

// Touch support
function handleGridTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
    });
    target.dispatchEvent(mouseEvent);
}

function handleGridTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
    });
    document.getElementById('zooGrid').dispatchEvent(mouseEvent);
}

function handleGridTouchEnd(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const mouseEvent = new MouseEvent('mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
    });
    document.getElementById('zooGrid').dispatchEvent(mouseEvent);
}

// Handle mouse leaving the SVG while dragging
function handleGridMouseLeave(e) {
    // If we're drawing or moving, continue tracking at document level
    // The mouse position will be clamped to grid bounds anyway
}

// Get grid coordinates from mouse event
function getGridPoint(e) {
    const svg = document.getElementById('zooGrid');
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Clamp to grid bounds
    const gridX = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(x / CELL_SIZE)));
    const gridY = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(y / CELL_SIZE)));
    
    return { gridX, gridY };
}

// Render the temporary drawing enclosure
function renderDrawingEnclosure() {
    if (!state.drawing) return;
    
    const { startX, startY, currentX, currentY } = state.drawing;
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX) + 1;
    const height = Math.abs(currentY - startY) + 1;
    
    let temp = document.getElementById('tempEnclosure');
    if (!temp) {
        temp = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        temp.id = 'tempEnclosure';
        temp.classList.add('enclosure-drawing');
        document.getElementById('enclosures').appendChild(temp);
    }
    
    // Check for overlap
    const hasOverlap = checkOverlap(x, y, width, height);
    
    // Check if meets animal requirements
    const area = width * height;
    const perimeter = 2 * (width + height);
    const animal = state.selectedAnimal ? ANIMALS.find(a => a.id === state.selectedAnimal) : null;
    const meetsRequirements = animal && area >= animal.minArea && perimeter >= animal.minPerimeter;
    
    temp.setAttribute('x', x * CELL_SIZE);
    temp.setAttribute('y', y * CELL_SIZE);
    temp.setAttribute('width', width * CELL_SIZE);
    temp.setAttribute('height', height * CELL_SIZE);
    
    // Change appearance based on validation
    if (hasOverlap) {
        // Red for overlap
        temp.setAttribute('stroke', '#f5576c');
        temp.setAttribute('fill', 'rgba(245, 87, 108, 0.2)');
    } else if (!meetsRequirements) {
        // Yellow/orange for too small
        temp.setAttribute('stroke', '#ffc107');
        temp.setAttribute('fill', 'rgba(255, 193, 7, 0.2)');
    } else {
        // Blue for valid
        temp.setAttribute('stroke', '#667eea');
        temp.setAttribute('fill', 'rgba(102, 126, 234, 0.2)');
    }
    
    // Add dimensions label
    let tempLabel = document.getElementById('tempEnclosureLabel');
    if (!tempLabel) {
        tempLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempLabel.id = 'tempEnclosureLabel';
        tempLabel.classList.add('label', 'temp-enclosure-label');
        document.getElementById('enclosures').appendChild(tempLabel);
    }
    
    tempLabel.setAttribute('x', (x + width / 2) * CELL_SIZE);
    tempLabel.setAttribute('y', (y + height / 2) * CELL_SIZE + 5);
    tempLabel.setAttribute('text-anchor', 'middle');
    tempLabel.setAttribute('font-size', '20');
    tempLabel.setAttribute('font-weight', 'bold');
    
    // Set color based on validation state
    let labelColor = '#667eea'; // Blue for valid
    if (hasOverlap) {
        labelColor = '#f5576c'; // Red for overlap
    } else if (!meetsRequirements) {
        labelColor = '#ffc107'; // Yellow for too small
    }
    tempLabel.setAttribute('fill', labelColor);
    tempLabel.textContent = `${width} × ${height}`;
}

// Add an enclosure
function addEnclosure(gridX, gridY, width, height) {
    // Don't add if no animal selected or animal already used
    if (!state.selectedAnimal) return;
    
    const usedAnimals = new Set(state.enclosures.map(e => e.animal));
    if (usedAnimals.has(state.selectedAnimal)) {
        return;
    }
    
    const id = `enclosure-${state.nextEnclosureId++}`;
    const enclosure = {
        id,
        gridX,
        gridY,
        width,
        height,
        animal: state.selectedAnimal, // Assigned from currently selected animal
    };
    
    state.enclosures.push(enclosure);
    renderEnclosure(enclosure);
    
    // Update animal list to show this animal as used
    renderAnimalList();
    
    // Update summary table
    updateSummaryTable();
}

// Render an enclosure
function renderEnclosure(enclosure) {
    // Remove existing if re-rendering
    const existing = document.getElementById(enclosure.id);
    if (existing) existing.remove();
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = enclosure.id;
    group.dataset.enclosureId = enclosure.id;
    
    const x = enclosure.gridX * CELL_SIZE;
    const y = enclosure.gridY * CELL_SIZE;
    const width = enclosure.width * CELL_SIZE;
    const height = enclosure.height * CELL_SIZE;
    
    // Check if position is valid
    const fitsInGrid = enclosure.gridX >= 0 && enclosure.gridY >= 0 &&
                       enclosure.gridX + enclosure.width <= GRID_SIZE &&
                       enclosure.gridY + enclosure.height <= GRID_SIZE;
    const hasOverlap = checkOverlap(enclosure.gridX, enclosure.gridY, enclosure.width, enclosure.height, enclosure.id);
    const isValidPlacement = fitsInGrid && !hasOverlap;
    
    // Check if enclosure meets animal requirements
    const area = enclosure.width * enclosure.height;
    const perimeter = 2 * (enclosure.width + enclosure.height);
    const animal = ANIMALS.find(a => a.id === enclosure.animal);
    const meetsRequirements = animal && area >= animal.minArea && perimeter >= animal.minPerimeter;
    
    // Enclosure rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.classList.add('enclosure');
    
    if (!isValidPlacement) {
        // Red for invalid placement (overlapping or off-grid)
        rect.classList.add('enclosure-invalid');
    } else if (!meetsRequirements) {
        // Yellow/orange warning for too small
        rect.classList.add('enclosure-warning');
    }
    
    group.appendChild(rect);
    
    // Render animal emoji and name (animal already found above for validation)
    if (animal) {
        // Animal emoji using foreignObject for proper sizing
        const minDimension = Math.min(width, height);
        const emojiSize = minDimension * 0.35; // Slightly bigger now since we have more space
        
        // Make foreignObject wider to avoid clipping
        const foreignObjectWidth = emojiSize * 1.5;
        
        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.setAttribute('x', x + (width - foreignObjectWidth) / 2);
        foreignObject.setAttribute('y', y + (height - emojiSize) / 2 - emojiSize * 0.2);
        foreignObject.setAttribute('width', foreignObjectWidth);
        foreignObject.setAttribute('height', emojiSize * 1.2);
        
        const emojiDiv = document.createElement('div');
        emojiDiv.style.fontSize = emojiSize + 'px';
        emojiDiv.style.lineHeight = emojiSize + 'px';
        emojiDiv.style.textAlign = 'center';
        emojiDiv.style.userSelect = 'none';
        emojiDiv.style.pointerEvents = 'none';
        emojiDiv.style.overflow = 'visible';
        emojiDiv.textContent = animal.emoji;
        
        foreignObject.appendChild(emojiDiv);
        group.appendChild(foreignObject);
        
        // Animal name - positioned below emoji with more spacing
        const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', x + width / 2);
        nameText.setAttribute('y', y + height / 2 + emojiSize * 0.7);
        nameText.setAttribute('class', 'label enclosure-label');
        nameText.setAttribute('font-size', Math.max(16, minDimension * 0.13));
        nameText.setAttribute('font-weight', 'bold');
        nameText.textContent = animal.name;
        group.appendChild(nameText);
        
        // Dimensions label - positioned below name
        const dimText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        dimText.setAttribute('x', x + width / 2);
        dimText.setAttribute('y', y + height / 2 + emojiSize * 0.7 + 18);
        dimText.setAttribute('class', 'label enclosure-label');
        dimText.setAttribute('font-size', Math.max(12, minDimension * 0.1));
        dimText.setAttribute('opacity', '0.8');
        dimText.textContent = `${enclosure.width} × ${enclosure.height}`;
        group.appendChild(dimText);
    }
    
    document.getElementById('enclosures').appendChild(group);
}

// Custom confirmation dialog
function showConfirmDialog(message, onConfirm, emoji = '🦁', title = 'Zoo Planner') {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
        <div class="confirm-content">
            <div class="confirm-emoji">${emoji}</div>
            <h3>${title}</h3>
            <p class="confirm-message">${message}</p>
            <div class="confirm-buttons">
                <button class="confirm-yes">Yes</button>
                <button class="confirm-no">No</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const yesBtn = modal.querySelector('.confirm-yes');
    const noBtn = modal.querySelector('.confirm-no');
    
    yesBtn.addEventListener('click', () => {
        modal.remove();
        onConfirm();
    });
    
    noBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Click outside to cancel
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Focus the No button by default (safer)
    noBtn.focus();
}

// Delete a building
function deleteBuilding(id) {
    state.placedBuildings = state.placedBuildings.filter(b => b.id !== id);
    const el = document.getElementById(id);
    if (el) el.remove();
    
    // Update building list to show buildings as available again
    renderBuildingList();
}

// Delete a building by type (no confirmation - from sidebar button)
function deleteBuildingByType(buildingType) {
    const building = state.placedBuildings.find(b => b.id.includes(buildingType));
    if (building) {
        deleteBuilding(building.id);
    }
}

// Delete an enclosure
function deleteEnclosure(id) {
    state.enclosures = state.enclosures.filter(e => e.id !== id);
    const el = document.getElementById(id);
    if (el) el.remove();
    
    // Update animal list to show animals as available again
    renderAnimalList();
    
    // Update summary table
    updateSummaryTable();
}

// Delete an enclosure by animal type (no confirmation - from sidebar button)
function deleteEnclosureByAnimal(animalId) {
    const enclosure = state.enclosures.find(e => e.animal === animalId);
    if (enclosure) {
        deleteEnclosure(enclosure.id);
    }
}

// Start over - clear all items
function startOver() {
    showConfirmDialog('Are you sure you want to start over? This will clear everything!', () => {
        state.placedBuildings = [];
        state.enclosures = [];
        state.nextEnclosureId = 1;
        state.selectedAnimal = null;
        state.zooName = '';
        
        document.getElementById('buildings').innerHTML = '';
        document.getElementById('enclosures').innerHTML = '';
        document.getElementById('zooName').value = '';
        document.title = 'Zoo Planner - Design Your Zoo!';
        
        // Reset both lists
        renderAnimalList();
        renderBuildingList();
        
        // Update summary table
        updateSummaryTable();
    }, '🔄', 'Start Over');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
} else {
    init();
}

