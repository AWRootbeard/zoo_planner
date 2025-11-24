// Zoo Planner App - Vanilla JavaScript
// No build tools, no frameworks, just fun!

const GRID_SIZE = 30; // Grid is 30x30 squares
const CELL_SIZE = 20; // Each square is 20px

// Building definitions - loaded from JSON
let BUILDINGS = [];

// Decoration definitions - loaded from JSON
let DECORATIONS = [];

// Animal definitions - loaded from JSON
let ANIMALS = [];

// App state
const state = {
    selectedAnimal: null, // Currently selected animal to draw
    placedBuildings: [],
    placedDecorations: [],
    enclosures: [],
    drawing: null,
    draggingBuilding: null, // Building being dragged from palette
    movingItem: null, // Item being moved on grid
    moveStartPos: null, // Starting position for distinguishing click vs drag
    resizingEnclosure: null, // Enclosure being resized
    nextEnclosureId: 1,
    nextBuildingId: 1,
    nextDecorationId: 1,
    zooName: '', // Name of the zoo
};

// Check if a rectangle overlaps with any existing buildings, decorations, or enclosures
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
    
    // Check decorations
    for (const decoration of state.placedDecorations) {
        if (decoration.id === excludeId) continue;
        
        if (!(gridX + width <= decoration.gridX ||
              gridX >= decoration.gridX + decoration.width ||
              gridY + height <= decoration.gridY ||
              gridY >= decoration.gridY + decoration.height)) {
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

async function loadDecorations() {
    try {
        const response = await fetch('decorations.json');
        const decorationsData = await response.json();
        
        // Convert to app format with id field
        DECORATIONS = decorationsData.map(decoration => ({
            id: decoration.name.toLowerCase().replace(/\s+/g, ''),
            name: decoration.name,
            emoji: decoration.emoji,
            width: decoration.width,
            height: decoration.height,
            color: decoration.color
        }));
        
        return true;
    } catch (error) {
        console.error('Error loading decorations:', error);
        return false;
    }
}

// Initialize the app
async function init() {
    // Load data files first
    const [animalsLoaded, buildingsLoaded, decorationsLoaded] = await Promise.all([
        loadAnimals(),
        loadBuildings(),
        loadDecorations()
    ]);
    
    if (!animalsLoaded || !buildingsLoaded || !decorationsLoaded) {
        alert('Error loading zoo data. Please refresh the page.');
        return;
    }
    
    setupGrid();
    setupBuildingsPalette();
    setupDecorationsPalette();
    setupAnimalList();
    setupToolButtons();
    setupEventListeners();
    setupZooName();
    setupShareButton();
    setupCollapsibleSections();
    
    // Load zoo from URL if present
    const loaded = loadFromURL();
    
    if (!loaded) {
        updateSummaryTable();
    }
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
            <td class="perimeter-cell ${perimeterTooSmall ? 'too-small' : ''}">${perimeter}/${animal.minPerimeter}</td>
            <td class="area-cell ${areaTooSmall ? 'too-small' : ''}">${area}/${animal.minArea}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Base36 encoding for compact URLs (0-9, a-z = 0-35)
function toBase36(num) {
    return num.toString(36);
}

function fromBase36(str) {
    return parseInt(str, 36);
}

// Encode zoo state to URL parameters (very compact format)
function encodeZooState() {
    // Buildings: 3 chars each (typeIndex + x + y in base36)
    // Decorations: 3 chars each (typeIndex + x + y in base36)
    // Enclosures: 5 chars each (animalIndex + x + y + w + h in base36)
    // Format: buildings.decorations.enclosures
    
    const buildingStr = state.placedBuildings.map(b => {
        const typeId = b.id.split('-')[0];
        const typeIndex = BUILDINGS.findIndex(building => building.id === typeId);
        return toBase36(typeIndex) + toBase36(b.gridX) + toBase36(b.gridY);
    }).join('');
    
    const decorationStr = state.placedDecorations.map(d => {
        const typeId = d.id.split('-')[0];
        const typeIndex = DECORATIONS.findIndex(decoration => decoration.id === typeId);
        return toBase36(typeIndex) + toBase36(d.gridX) + toBase36(d.gridY);
    }).join('');
    
    const enclosureStr = state.enclosures.map(e => {
        const animalIndex = ANIMALS.findIndex(a => a.id === e.animal);
        return toBase36(animalIndex) + toBase36(e.gridX) + toBase36(e.gridY) + 
               toBase36(e.width) + toBase36(e.height);
    }).join('');
    
    // Remove trailing periods to prevent issues when sharing on Slack
    return (buildingStr + '.' + decorationStr + '.' + enclosureStr).replace(/\.+$/, '');
}

// Decode zoo state from URL parameters (very compact format)
function decodeZooState(compact) {
    try {
        const parts = compact.split('.');
        // Always assume new 3-part format: buildings.decorations.enclosures
        // Pad with empty strings if trailing sections were stripped
        const buildingStr = parts[0] || '';
        const decorationStr = parts[1] || '';
        const enclosureStr = parts[2] || '';
        
        const buildings = [];
        if (buildingStr && buildingStr.length > 0) {
            for (let i = 0; i < buildingStr.length; i += 3) {
                if (i + 3 <= buildingStr.length) {
                    buildings.push({
                        typeIndex: fromBase36(buildingStr[i]),
                        x: fromBase36(buildingStr[i + 1]),
                        y: fromBase36(buildingStr[i + 2])
                    });
                }
            }
        }
        
        const decorations = [];
        if (decorationStr && decorationStr.length > 0) {
            for (let i = 0; i < decorationStr.length; i += 3) {
                if (i + 3 <= decorationStr.length) {
                    decorations.push({
                        typeIndex: fromBase36(decorationStr[i]),
                        x: fromBase36(decorationStr[i + 1]),
                        y: fromBase36(decorationStr[i + 2])
                    });
                }
            }
        }
        
        const enclosures = [];
        if (enclosureStr && enclosureStr.length > 0) {
            for (let i = 0; i < enclosureStr.length; i += 5) {
                if (i + 5 <= enclosureStr.length) {
                    enclosures.push({
                        animalIndex: fromBase36(enclosureStr[i]),
                        x: fromBase36(enclosureStr[i + 1]),
                        y: fromBase36(enclosureStr[i + 2]),
                        w: fromBase36(enclosureStr[i + 3]),
                        h: fromBase36(enclosureStr[i + 4])
                    });
                }
            }
        }
        
        return { buildings, decorations, enclosures };
    } catch (e) {
        console.error('Error decoding zoo state:', e);
        return null;
    }
}

// Update URL with current state
function updateURL() {
    const url = new URL(window.location.href);
    
    // Clear existing params
    url.search = '';
    
    // Zoo name first
    if (state.zooName) {
        url.searchParams.set('n', state.zooName);
    }
    
    // Then zoo data
    const encoded = encodeZooState();
    if (encoded && encoded !== '.' && encoded !== '..') { // Only add if there's actual data
        url.searchParams.set('z', encoded);
    }
    
    window.history.replaceState({}, '', url);
}

// Load zoo from URL if present
function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('z');
    const zooName = params.get('n');
    
    // Set zoo name
    if (zooName) {
        state.zooName = zooName;
        document.getElementById('zooName').value = zooName;
        document.title = `${zooName} - Zoo Planner`;
    }
    
    if (!encoded) return false;
    
    const data = decodeZooState(encoded);
    if (!data) return false;
    
    // Place buildings (skip URL updates during loading)
    if (data.buildings && data.buildings.length > 0) {
        data.buildings.forEach(bData => {
            const buildingDef = BUILDINGS[bData.typeIndex];
            if (buildingDef) {
                addBuilding(buildingDef, bData.x, bData.y, true);
            }
        });
    }
    
    // Place decorations (skip URL updates during loading)
    if (data.decorations && data.decorations.length > 0) {
        data.decorations.forEach(dData => {
            const decorationDef = DECORATIONS[dData.typeIndex];
            if (decorationDef) {
                addDecoration(decorationDef, dData.x, dData.y, true);
            }
        });
    }
    
    // Create enclosures
    if (data.enclosures && data.enclosures.length > 0) {
        data.enclosures.forEach(eData => {
            const id = `enclosure-${state.nextEnclosureId++}`;
            const animal = ANIMALS[eData.animalIndex];
            if (!animal) return;
            
            const enclosure = {
                id,
                gridX: eData.x,
                gridY: eData.y,
                width: eData.w,
                height: eData.h,
                animal: animal.id
            };
            state.enclosures.push(enclosure);
            renderEnclosure(enclosure);
        });
        
        // Update UI
        renderAnimalList();
        updateSummaryTable();
    }
    
    // Now that everything is loaded, update the URL once
    updateURL();
    
    return true;
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
    
    // Save to state and update URL when changed
    zooNameInput.addEventListener('change', () => {
        state.zooName = zooNameInput.value.trim();
        updateURL();
    });
}

// Setup share button
function setupShareButton() {
    const shareBtn = document.getElementById('shareBtn');
    
    shareBtn.addEventListener('click', async () => {
        const url = new URL(window.location.href);
        url.search = '';
        
        // Zoo name first
        if (state.zooName) {
            url.searchParams.set('n', state.zooName);
        }
        
        // Then zoo data
        const encoded = encodeZooState();
        if (encoded && encoded !== '.' && encoded !== '..') {
            url.searchParams.set('z', encoded);
        }
        
        const shareUrl = url.toString();
        
        try {
            await navigator.clipboard.writeText(shareUrl);
            
            // Visual feedback
            shareBtn.textContent = '✓ Copied!';
            shareBtn.classList.add('copied');
            
            setTimeout(() => {
                shareBtn.textContent = '🔗 Share Zoo';
                shareBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            
            shareBtn.textContent = '✓ Copied!';
            shareBtn.classList.add('copied');
            
            setTimeout(() => {
                shareBtn.textContent = '🔗 Share Zoo';
                shareBtn.classList.remove('copied');
            }, 2000);
        }
    });
}

// Setup collapsible sections
function setupCollapsibleSections() {
    const decorationsHeader = document.getElementById('decorationsHeader');
    const decorationsContent = document.getElementById('decorationsContent');
    
    decorationsHeader.addEventListener('click', () => {
        // Toggle collapsed class on header and content
        decorationsHeader.classList.toggle('collapsed');
        decorationsContent.classList.toggle('collapsed');
    });
    
    // Start collapsed by default
    decorationsHeader.classList.add('collapsed');
    decorationsContent.classList.add('collapsed');
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
        const isRestroom = building.id === 'restroom';
        const isUsed = Array.from(usedBuildings).some(used => used.includes(building.id));
        const restroomCount = isRestroom ? state.placedBuildings.filter(b => b.id.startsWith('restroom-')).length : 0;
        
        const div = document.createElement('div');
        div.className = 'building-item';
        div.dataset.buildingId = building.id;
        
        // Restrooms are special: never disabled, always draggable
        if (isRestroom) {
            div.draggable = true;
            div.addEventListener('dragstart', handlePaletteDragStart);
            div.addEventListener('dragend', handlePaletteDragEnd);
        } else if (isUsed) {
            div.classList.add('used');
        } else {
            div.draggable = true;
            div.addEventListener('dragstart', handlePaletteDragStart);
            div.addEventListener('dragend', handlePaletteDragEnd);
        }
        
        // Build the HTML
        let html = `
            <span class="building-emoji">${building.emoji}</span>
            <div class="building-info">
                <div class="building-name">${building.name}${isRestroom && restroomCount > 0 ? ` (${restroomCount})` : ''}</div>
                <span class="building-size">${building.width}×${building.height} squares</span>
            </div>
        `;
        
        // Add delete button for restrooms (if any placed) or regular buildings (if used)
        if (isRestroom && restroomCount > 0) {
            html += '<button class="delete-building-btn" title="Delete all restrooms">🗑️</button>';
        } else if (!isRestroom && isUsed) {
            html += '<button class="delete-building-btn" title="Delete this building">🗑️</button>';
        }
        
        div.innerHTML = html;
        
        // Delete button handler
        const deleteBtn = div.querySelector('.delete-building-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isRestroom) {
                    deleteAllRestrooms();
                } else {
                    deleteBuildingByType(building.id);
                }
            });
        }
        
        buildingList.appendChild(div);
    });
}

// Setup decorations palette
function setupDecorationsPalette() {
    renderDecorationList();
}

// Render the decoration list
function renderDecorationList() {
    const decorationList = document.getElementById('decorationList');
    decorationList.innerHTML = '';
    
    DECORATIONS.forEach(decoration => {
        const decorationCount = state.placedDecorations.filter(d => d.id.startsWith(decoration.id + '-')).length;
        
        const div = document.createElement('div');
        div.className = 'building-item'; // Reuse building-item styling
        div.dataset.buildingId = decoration.id; // Use same data attribute for drag handling
        div.draggable = true;
        div.addEventListener('dragstart', handlePaletteDragStart);
        div.addEventListener('dragend', handlePaletteDragEnd);
        
        // Build the HTML
        let html = `
            <span class="building-emoji">${decoration.emoji}</span>
            <div class="building-info">
                <div class="building-name">${decoration.name}${decorationCount > 0 ? ` (${decorationCount})` : ''}</div>
                <span class="building-size">${decoration.width}×${decoration.height} squares</span>
            </div>
        `;
        
        // Add delete button if any are placed
        if (decorationCount > 0) {
            html += '<button class="delete-building-btn" title="Delete all">🗑️</button>';
        }
        
        div.innerHTML = html;
        
        // Delete button handler
        const deleteBtn = div.querySelector('.delete-building-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteAllDecorationType(decoration.id);
            });
        }
        
        decorationList.appendChild(div);
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
                <small>Min Perimeter: ${animal.minPerimeter}</small>
                <small>Min Area: ${animal.minArea}</small>
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
    
    // Store the building or decoration being dragged
    let item = BUILDINGS.find(b => b.id === buildingId);
    if (!item) {
        item = DECORATIONS.find(d => d.id === buildingId);
    }
    state.draggingBuilding = item;
    
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
    
    const itemId = e.dataTransfer.getData('buildingId');
    if (!itemId) return;
    
    // Check if it's a building or decoration
    let item = BUILDINGS.find(b => b.id === itemId);
    let isDecoration = false;
    
    if (!item) {
        item = DECORATIONS.find(d => d.id === itemId);
        isDecoration = true;
    }
    
    if (!item) return;
    
    // Check if this building type is already placed (except restrooms and decorations which can have multiples)
    if (!isDecoration) {
        const isRestroom = item.id === 'restroom';
        const alreadyPlaced = state.placedBuildings.some(b => b.id.includes(item.id));
        if (!isRestroom && alreadyPlaced) {
            state.draggingBuilding = null;
            return;
        }
    }
    
    const svg = document.getElementById('zooGrid');
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Snap to grid
    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);
    
    // Check if it fits and doesn't overlap
    const fitsInGrid = gridX + item.width <= GRID_SIZE && gridY + item.height <= GRID_SIZE;
    const hasOverlap = checkOverlap(gridX, gridY, item.width, item.height);
    
    if (fitsInGrid && !hasOverlap) {
        if (isDecoration) {
            addDecoration(item, gridX, gridY);
        } else {
            addBuilding(item, gridX, gridY);
        }
    }
    
    // Clear dragging state
    state.draggingBuilding = null;
}

// Add a building to the grid
function addBuilding(buildingDef, gridX, gridY, skipURLUpdate = false) {
    const id = `${buildingDef.id}-${state.nextBuildingId++}`;
    const building = {
        ...buildingDef,
        id,  // Put id AFTER spread so it doesn't get overwritten
        gridX,
        gridY,
    };
    
    state.placedBuildings.push(building);
    renderBuilding(building);
    
    // Update building list to show this building as used
    renderBuildingList();
    
    // Update URL (unless we're loading from URL)
    if (!skipURLUpdate) {
        updateURL();
    }
}

// Add a decoration to the grid
function addDecoration(decorationDef, gridX, gridY, skipURLUpdate = false) {
    const id = `${decorationDef.id}-${state.nextDecorationId++}`;
    const decoration = {
        ...decorationDef,
        id,  // Put id AFTER spread so it doesn't get overwritten
        gridX,
        gridY,
    };
    
    state.placedDecorations.push(decoration);
    renderBuilding(decoration); // Reuse renderBuilding since decorations look the same
    
    // Update decoration list to show count
    renderDecorationList();
    
    // Update URL (unless we're loading from URL)
    if (!skipURLUpdate) {
        updateURL();
    }
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
    
    // Emoji - special handling for bench (two chairs) vs other items
    const isBench = building.id && building.id.includes('bench');
    
    if (isBench) {
        // Bench: show two chair emojis side by side
        const fontSize = Math.min(width, height) * 0.6;
        const spacing = width / 3;
        
        const chair1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        chair1.setAttribute('x', x + spacing);
        chair1.setAttribute('y', y + height / 2);
        chair1.setAttribute('class', 'building-label');
        chair1.setAttribute('font-size', fontSize);
        chair1.setAttribute('dominant-baseline', 'central'); // Better vertical centering
        chair1.textContent = building.emoji;
        group.appendChild(chair1);
        
        const chair2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        chair2.setAttribute('x', x + width - spacing);
        chair2.setAttribute('y', y + height / 2);
        chair2.setAttribute('class', 'building-label');
        chair2.setAttribute('font-size', fontSize);
        chair2.setAttribute('dominant-baseline', 'central'); // Better vertical centering
        chair2.textContent = building.emoji;
        group.appendChild(chair2);
    } else {
        // Normal items: single centered emoji
        const emoji = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        emoji.setAttribute('x', x + width / 2);
        
        if (building.height === 1) {
            // For 1-tall items: larger emoji, perfectly centered
            emoji.setAttribute('y', y + height / 2);
            emoji.setAttribute('font-size', Math.min(width, height) * 0.6);
            emoji.setAttribute('dominant-baseline', 'central'); // Better vertical centering
        } else {
            // For taller items: normal size with slight offset for text below
            emoji.setAttribute('y', y + height / 2 - 5);
            emoji.setAttribute('font-size', Math.min(width, height) * 0.4);
            emoji.setAttribute('dominant-baseline', 'middle'); // Better vertical centering
        }
        
        emoji.setAttribute('class', 'building-label');
        emoji.textContent = building.emoji;
        group.appendChild(emoji);
    }
    
    // Name (only show if tall enough - at least 2 grid cells high)
    if (building.height >= 2) {
        const name = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        name.setAttribute('x', x + width / 2);
        name.setAttribute('y', y + height / 2 + 12);
        name.setAttribute('class', 'building-label');
        name.setAttribute('font-size', '10');
        name.textContent = building.name;
        group.appendChild(name);
    }
    
    document.getElementById('buildings').appendChild(group);
}

// Grid interaction - Drawing enclosures or moving items
function handleGridMouseDown(e) {
    const point = getGridPoint(e);
    const precisePoint = getGridPoint(e, true); // Use precise position for edge detection
    
    // Check if near an enclosure edge for resizing
    const edgeDetect = detectEnclosureEdge(precisePoint.gridX, precisePoint.gridY);
    if (edgeDetect) {
        // Start resizing
        state.resizingEnclosure = {
            enclosure: edgeDetect.enclosure,
            edge: edgeDetect.edge,
            originalData: {
                gridX: edgeDetect.enclosure.gridX,
                gridY: edgeDetect.enclosure.gridY,
                width: edgeDetect.enclosure.width,
                height: edgeDetect.enclosure.height
            }
        };
        state.moveStartPos = { x: e.clientX, y: e.clientY };
        return;
    }
    
    // Check if clicking on an existing enclosure (not near edge)
    const enclosureEl = e.target.closest('.enclosure');
    if (enclosureEl) {
        const id = enclosureEl.closest('g').dataset.enclosureId;
        const enclosure = state.enclosures.find(enc => enc.id === id);
        if (enclosure) {
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
    
    // Check if clicking on a building or decoration
    const buildingEl = e.target.closest('.building');
    if (buildingEl) {
        const id = buildingEl.closest('g').dataset.buildingId;
        let item = state.placedBuildings.find(b => b.id === id);
        let itemType = 'building';
        
        if (!item) {
            item = state.placedDecorations.find(d => d.id === id);
            itemType = 'decoration';
        }
        
        if (item) {
            // Start moving
            state.movingItem = {
                type: itemType,
                id: id,
                data: item,
                originalX: item.gridX,
                originalY: item.gridY,
                offsetX: point.gridX - item.gridX,
                offsetY: point.gridY - item.gridY,
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

// Detect if mouse is near an enclosure edge
function detectEnclosureEdge(mouseGridX, mouseGridY) {
    const EDGE_THRESHOLD = 0.3; // Within 0.3 grid cells of edge
    
    for (const enclosure of state.enclosures) {
        const left = enclosure.gridX;
        const right = enclosure.gridX + enclosure.width;
        const top = enclosure.gridY;
        const bottom = enclosure.gridY + enclosure.height;
        
        // Check if mouse is inside the enclosure bounds (with threshold)
        if (mouseGridX >= left - EDGE_THRESHOLD && mouseGridX <= right + EDGE_THRESHOLD &&
            mouseGridY >= top - EDGE_THRESHOLD && mouseGridY <= bottom + EDGE_THRESHOLD) {
            
            const nearLeft = Math.abs(mouseGridX - left) <= EDGE_THRESHOLD;
            const nearRight = Math.abs(mouseGridX - right) <= EDGE_THRESHOLD;
            const nearTop = Math.abs(mouseGridY - top) <= EDGE_THRESHOLD;
            const nearBottom = Math.abs(mouseGridY - bottom) <= EDGE_THRESHOLD;
            
            // Priority: corners first, then edges
            // Only one horizontal and one vertical edge can be true at once
            const isLeft = nearLeft && !nearRight;
            const isRight = nearRight && !nearLeft;
            const isTop = nearTop && !nearBottom;
            const isBottom = nearBottom && !nearTop;
            
            // Only resize from edges, not inside
            if (isLeft || isRight || isTop || isBottom) {
                return {
                    enclosure,
                    edge: {
                        left: isLeft,
                        right: isRight,
                        top: isTop,
                        bottom: isBottom
                    }
                };
            }
        }
    }
    
    return null;
}

// Update cursor based on resize edge
function updateResizeCursor(edge) {
    const svg = document.getElementById('zooGrid');
    
    if (!edge) {
        svg.style.cursor = 'crosshair';
        return;
    }
    
    if (edge.left && edge.top) svg.style.cursor = 'nw-resize';
    else if (edge.right && edge.top) svg.style.cursor = 'ne-resize';
    else if (edge.left && edge.bottom) svg.style.cursor = 'sw-resize';
    else if (edge.right && edge.bottom) svg.style.cursor = 'se-resize';
    else if (edge.left || edge.right) svg.style.cursor = 'ew-resize';
    else if (edge.top || edge.bottom) svg.style.cursor = 'ns-resize';
}

function handleGridMouseMove(e) {
    // Handle resizing an enclosure
    if (state.resizingEnclosure) {
        const point = getGridPoint(e); // Regular point for snapping to grid
        const resize = state.resizingEnclosure;
        const enc = resize.enclosure;
        
        // Keep the cursor correct during resize
        updateResizeCursor(resize.edge);
        
        let newX = enc.gridX;
        let newY = enc.gridY;
        let newWidth = enc.width;
        let newHeight = enc.height;
        
        // Calculate new dimensions based on which edge is being dragged
        if (resize.edge.right) {
            newWidth = Math.max(1, point.gridX - enc.gridX + 1);
        }
        if (resize.edge.left) {
            const oldRight = enc.gridX + enc.width;
            newX = Math.min(point.gridX, oldRight - 1);
            newWidth = oldRight - newX;
        }
        if (resize.edge.bottom) {
            newHeight = Math.max(1, point.gridY - enc.gridY + 1);
        }
        if (resize.edge.top) {
            const oldBottom = enc.gridY + enc.height;
            newY = Math.min(point.gridY, oldBottom - 1);
            newHeight = oldBottom - newY;
        }
        
        // Constrain to grid
        newX = Math.max(0, Math.min(newX, GRID_SIZE - 1));
        newY = Math.max(0, Math.min(newY, GRID_SIZE - 1));
        newWidth = Math.max(1, Math.min(newWidth, GRID_SIZE - newX));
        newHeight = Math.max(1, Math.min(newHeight, GRID_SIZE - newY));
        
        // Check for overlap with other items (excluding this enclosure)
        const hasOverlap = checkOverlap(newX, newY, newWidth, newHeight, enc.id);
        
        // Only update if no overlap
        if (!hasOverlap) {
            enc.gridX = newX;
            enc.gridY = newY;
            enc.width = newWidth;
            enc.height = newHeight;
            
            renderEnclosure(enc);
            updateSummaryTable();
            updateURL();
        }
        // If there's overlap, just don't resize - keep current position
        return;
    }
    
    // Handle moving an existing item
    if (state.movingItem) {
        // Only update if mouse is near the grid
        const svg = document.getElementById('zooGrid');
        const rect = svg.getBoundingClientRect();
        
        // Keep move cursor
        svg.style.cursor = 'grabbing';
        
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
    if (state.drawing) {
        const point = getGridPoint(e);
        state.drawing.currentX = point.gridX;
        state.drawing.currentY = point.gridY;
        renderDrawingEnclosure();
        
        // Keep crosshair cursor while drawing
        const svg = document.getElementById('zooGrid');
        svg.style.cursor = 'crosshair';
        return;
    }
    
    // Update cursor for resize handles when not doing anything else
    const precisePoint = getGridPoint(e, true); // Use precise position for edge detection
    const edgeDetect = detectEnclosureEdge(precisePoint.gridX, precisePoint.gridY);
    
    if (edgeDetect) {
        // Near an edge - show resize cursor
        updateResizeCursor(edgeDetect.edge);
    } else {
        // Check if over an enclosure (not near edge) - show move cursor
        const regularPoint = getGridPoint(e);
        const overEnclosure = state.enclosures.find(enc => 
            regularPoint.gridX >= enc.gridX && 
            regularPoint.gridX < enc.gridX + enc.width &&
            regularPoint.gridY >= enc.gridY && 
            regularPoint.gridY < enc.gridY + enc.height
        );
        
        const svg = document.getElementById('zooGrid');
        if (overEnclosure) {
            svg.style.cursor = 'move';
        } else {
            svg.style.cursor = 'crosshair';
        }
    }
}

function handleGridMouseUp(e) {
    // Handle finishing a resize
    if (state.resizingEnclosure) {
        const distanceMoved = state.moveStartPos ? Math.sqrt(
            Math.pow(e.clientX - state.moveStartPos.x, 2) +
            Math.pow(e.clientY - state.moveStartPos.y, 2)
        ) : 100;
        
        // If barely moved, treat as click for delete
        if (distanceMoved < 5) {
            const enc = state.resizingEnclosure.enclosure;
            const orig = state.resizingEnclosure.originalData;
            
            // Restore original
            enc.gridX = orig.gridX;
            enc.gridY = orig.gridY;
            enc.width = orig.width;
            enc.height = orig.height;
            
            renderEnclosure(enc);
            updateSummaryTable();
            
            const animal = ANIMALS.find(a => a.id === enc.animal);
            const emoji = animal ? animal.emoji : '🦁';
            const name = animal ? animal.name : 'Enclosure';
            showConfirmDialog('Delete this enclosure?', () => {
                deleteEnclosure(enc.id);
            }, emoji, name);
        }
        
        state.resizingEnclosure = null;
        state.moveStartPos = null;
        
        // Reset cursor
        const svg = document.getElementById('zooGrid');
        svg.style.cursor = 'crosshair';
        return;
    }
    
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
            } else if (item.type === 'decoration') {
                renderBuilding(item.data); // Decorations render same as buildings
                showConfirmDialog('Delete this decoration?', () => {
                    deleteDecoration(item.id);
                }, item.data.emoji, item.data.name);
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
        
        // Update URL with new position
        updateURL();
        
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
function getGridPoint(e, precise = false) {
    const svg = document.getElementById('zooGrid');
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (precise) {
        // Return precise floating point position for edge detection
        const gridX = Math.max(0, Math.min(GRID_SIZE, x / CELL_SIZE));
        const gridY = Math.max(0, Math.min(GRID_SIZE, y / CELL_SIZE));
        return { gridX, gridY };
    } else {
        // Return integer grid cell for normal operations
        const gridX = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(x / CELL_SIZE)));
        const gridY = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(y / CELL_SIZE)));
        return { gridX, gridY };
    }
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
    
    // Update URL
    updateURL();
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
        
        // Make foreignObject wider and taller to avoid clipping on different systems
        const foreignObjectWidth = emojiSize * 1.5;
        const foreignObjectHeight = emojiSize * 1.5; // Increased from 1.2 to prevent top cropping
        
        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.setAttribute('x', x + (width - foreignObjectWidth) / 2);
        foreignObject.setAttribute('y', y + (height - foreignObjectHeight) / 2 - emojiSize * 0.15);
        foreignObject.setAttribute('width', foreignObjectWidth);
        foreignObject.setAttribute('height', foreignObjectHeight);
        
        const emojiDiv = document.createElement('div');
        emojiDiv.style.fontSize = emojiSize + 'px';
        emojiDiv.style.lineHeight = '1.3'; // Use ratio instead of fixed px to prevent cropping
        emojiDiv.style.textAlign = 'center';
        emojiDiv.style.userSelect = 'none';
        emojiDiv.style.pointerEvents = 'none';
        emojiDiv.style.overflow = 'visible';
        emojiDiv.style.paddingTop = '0.1em'; // Add slight top padding for systems with tall emojis
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
    
    // Update URL
    updateURL();
}

// Delete a decoration
function deleteDecoration(id) {
    state.placedDecorations = state.placedDecorations.filter(d => d.id !== id);
    const el = document.getElementById(id);
    if (el) el.remove();
    
    // Update decoration list to show count
    renderDecorationList();
    
    // Update URL
    updateURL();
}

// Delete a building by type (no confirmation - from sidebar button)
function deleteBuildingByType(buildingType) {
    const building = state.placedBuildings.find(b => b.id.includes(buildingType));
    if (building) {
        deleteBuilding(building.id);
    }
}

// Delete all restrooms (no confirmation - from sidebar button)
function deleteAllRestrooms() {
    // Get all restroom IDs
    const restroomIds = state.placedBuildings
        .filter(b => b.id.startsWith('restroom-'))
        .map(b => b.id);
    
    // Remove them from state
    state.placedBuildings = state.placedBuildings.filter(b => !b.id.startsWith('restroom-'));
    
    // Remove from DOM
    restroomIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    
    // Update UI
    renderBuildingList();
    
    // Update URL
    updateURL();
}

// Delete all decorations of a type (no confirmation - from sidebar button)
function deleteAllDecorationType(decorationType) {
    // Get all decoration IDs of this type
    const decorationIds = state.placedDecorations
        .filter(d => d.id.startsWith(decorationType + '-'))
        .map(d => d.id);
    
    // Remove them from state
    state.placedDecorations = state.placedDecorations.filter(d => !d.id.startsWith(decorationType + '-'));
    
    // Remove from DOM
    decorationIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    
    // Update UI
    renderDecorationList();
    
    // Update URL
    updateURL();
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
    
    // Update URL
    updateURL();
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
        state.placedDecorations = [];
        state.enclosures = [];
        state.nextEnclosureId = 1;
        state.selectedAnimal = null;
        state.zooName = '';
        
        document.getElementById('buildings').innerHTML = '';
        document.getElementById('enclosures').innerHTML = '';
        document.getElementById('zooName').value = '';
        document.title = 'Zoo Planner - Design Your Zoo!';
        
        // Reset all lists
        renderAnimalList();
        renderBuildingList();
        renderDecorationList();
        
        // Update summary table
        updateSummaryTable();
        
        // Clear URL parameters
        window.history.replaceState({}, '', window.location.pathname);
    }, '🔄', 'Start Over');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
} else {
    init();
}

