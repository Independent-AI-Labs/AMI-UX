/**
 * Tile Manager - Manages hexagonal grid tiles with unique IDs
 */

import gridSystem from './core/GridSystem';

export class TileManager {
    constructor(hexSize = 180) {
        this.hexSize = hexSize;
        this.tiles = new Map(); // Map of tileId -> tile object
        this.occupiedTiles = new Set(); // Set of occupied tile IDs
        this.currentHoveredTile = null;
        this.rightClickedTile = null;
    }

    // Generate unique tile ID from hex coordinates
    getTileId(q, r) {
        return `tile_${q}_${r}`;
    }

    // Parse tile ID back to coordinates
    parseTileId(tileId) {
        const parts = tileId.split('_');
        return {
            q: parseInt(parts[1]),
            r: parseInt(parts[2])
        };
    }

    // Convert hex coordinates to pixel coordinates - use unified grid system
    hexToPixel(q, r) {
        return gridSystem.gridToWorld(q, r);
    }

    // Convert pixel coordinates to hex coordinates - use unified grid system
    pixelToHex(x, y) {
        return gridSystem.worldToGrid(x, y);
    }

    // Get or create a tile object
    getTile(q, r) {
        const tileId = this.getTileId(q, r);
        
        if (!this.tiles.has(tileId)) {
            const pixelPos = this.hexToPixel(q, r);
            const tile = {
                id: tileId,
                q: q,
                r: r,
                x: pixelPos.x,
                y: pixelPos.y,
                occupied: false,
                occupant: null, // 'message', 'input', 'typing', etc.
                conversationId: null
            };
            this.tiles.set(tileId, tile);
        }
        
        return this.tiles.get(tileId);
    }

    // Get tile at pixel coordinates
    getTileAtPixel(pixelX, pixelY) {
        const hexCoords = this.pixelToHex(pixelX, pixelY);
        return this.getTile(hexCoords.q, hexCoords.r);
    }

    // Mark tile as occupied
    occupyTile(q, r, occupant, conversationId = null) {
        const tile = this.getTile(q, r);
        tile.occupied = true;
        tile.occupant = occupant;
        tile.conversationId = conversationId;
        this.occupiedTiles.add(tile.id);
        return tile;
    }

    // Free a tile
    freeTile(q, r) {
        const tile = this.getTile(q, r);
        tile.occupied = false;
        tile.occupant = null;
        tile.conversationId = null;
        this.occupiedTiles.delete(tile.id);
        return tile;
    }

    // Check if tile is occupied
    isTileOccupied(q, r) {
        const tileId = this.getTileId(q, r);
        return this.occupiedTiles.has(tileId);
    }

    // Set currently hovered tile
    setHoveredTile(q, r) {
        this.currentHoveredTile = this.getTile(q, r);
        return this.currentHoveredTile;
    }

    // Set right-clicked tile
    setRightClickedTile(q, r) {
        this.rightClickedTile = this.getTile(q, r);
        return this.rightClickedTile;
    }

    // Get right-clicked tile
    getRightClickedTile() {
        return this.rightClickedTile;
    }

    // Find available conversation start position near a target tile
    findAvailableConversationStart(targetQ, targetR) {
        // Conversations need 2 adjacent columns (even Q and Q+1)
        // Start with the target position and find nearest even column
        let startQ = Math.floor(targetQ / 2) * 2;
        
        // Check if we can place a conversation starting at this position
        for (let offset = 0; offset <= 20; offset += 2) {
            const testQ = startQ + offset;
            
            // Check if both columns are available for at least a few rows
            let available = true;
            for (let row = 0; row < 6; row++) {
                if (this.isTileOccupied(testQ, row) || this.isTileOccupied(testQ + 1, row)) {
                    available = false;
                    break;
                }
            }
            
            if (available) {
                return { q: testQ, r: 0 };
            }
            
            // Try negative offset too
            if (offset > 0) {
                const testQNeg = startQ - offset;
                if (testQNeg >= 0) {
                    let availableNeg = true;
                    for (let row = 0; row < 6; row++) {
                        if (this.isTileOccupied(testQNeg, row) || this.isTileOccupied(testQNeg + 1, row)) {
                            availableNeg = false;
                            break;
                        }
                    }
                    
                    if (availableNeg) {
                        return { q: testQNeg, r: 0 };
                    }
                }
            }
        }
        
        // Fallback: find any available even column
        for (let q = 0; q < 40; q += 2) {
            let available = true;
            for (let row = 0; row < 6; row++) {
                if (this.isTileOccupied(q, row) || this.isTileOccupied(q + 1, row)) {
                    available = false;
                    break;
                }
            }
            if (available) {
                return { q: q, r: 0 };
            }
        }
        
        return { q: 0, r: 0 }; // Ultimate fallback
    }

    // Get all tiles in a radius
    getTilesInRadius(centerQ, centerR, radius) {
        const tiles = [];
        for (let q = centerQ - radius; q <= centerQ + radius; q++) {
            for (let r = centerR - radius; r <= centerR + radius; r++) {
                const distance = Math.sqrt((q - centerQ) ** 2 + (r - centerR) ** 2);
                if (distance <= radius) {
                    tiles.push(this.getTile(q, r));
                }
            }
        }
        return tiles;
    }
}

// Create singleton instance
const tileManager = new TileManager();
export default tileManager;