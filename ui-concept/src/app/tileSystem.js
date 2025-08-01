/**
 * Generic Tile System
 * 
 * Functional Data Tiles: Messages (persistent, contain data, part of server state)
 * UI Tiles: Input, Typing indicators (ephemeral, UI-only, for interaction)
 */

// Functional Data Tile - represents actual data/content
export class DataTile {
    constructor(id, type, data, position) {
        this.id = id;
        this.type = type; // 'message', 'document', etc.
        this.data = data; // actual content/data
        this.position = position; // { q, r }
        this.conversationId = data.conversationId;
        this.isPersistent = true; // saved to server
    }
}

// UI Tile - represents interface elements
export class UITile {
    constructor(id, type, position, metadata = {}) {
        this.id = id;
        this.type = type; // 'input', 'typing', 'selection', etc.
        this.position = position; // { q, r }
        this.metadata = metadata; // UI-specific data
        this.isPersistent = false; // not saved to server
        this.isVisible = true;
    }
}

// Tile Grid - manages both types of tiles
export class TileGrid {
    constructor() {
        this.dataTiles = new Map(); // id -> DataTile
        this.uiTiles = new Map(); // id -> UITile
        this.positionIndex = new Map(); // "q,r" -> Set of tile ids
        this.conversationIndex = new Map(); // conversationId -> Set of data tile ids
    }

    // Add a data tile (message, document, etc.)
    addDataTile(tile) {
        this.dataTiles.set(tile.id, tile);
        this._indexPosition(tile);
        
        if (tile.conversationId) {
            if (!this.conversationIndex.has(tile.conversationId)) {
                this.conversationIndex.set(tile.conversationId, new Set());
            }
            this.conversationIndex.get(tile.conversationId).add(tile.id);
        }
    }

    // Add a UI tile (input, typing, etc.)
    addUITile(tile) {
        this.uiTiles.set(tile.id, tile);
        this._indexPosition(tile);
    }

    // Remove tile by id
    removeTile(id) {
        const dataTile = this.dataTiles.get(id);
        const uiTile = this.uiTiles.get(id);
        const tile = dataTile || uiTile;
        
        if (!tile) return false;

        if (dataTile) {
            this.dataTiles.delete(id);
            if (tile.conversationId) {
                const convSet = this.conversationIndex.get(tile.conversationId);
                if (convSet) {
                    convSet.delete(id);
                    if (convSet.size === 0) {
                        this.conversationIndex.delete(tile.conversationId);
                    }
                }
            }
        } else {
            this.uiTiles.delete(id);
        }

        this._unindexPosition(tile);
        return true;
    }

    // Check if position is occupied by any tile
    isPositionOccupied(q, r) {
        const key = `${q},${r}`;
        const tileIds = this.positionIndex.get(key);
        return tileIds && tileIds.size > 0;
    }

    // Get all tiles at position
    getTilesAtPosition(q, r) {
        const key = `${q},${r}`;
        const tileIds = this.positionIndex.get(key) || new Set();
        const tiles = [];
        
        for (const id of tileIds) {
            const tile = this.dataTiles.get(id) || this.uiTiles.get(id);
            if (tile) tiles.push(tile);
        }
        
        return tiles;
    }

    // Get all data tiles in a conversation
    getConversationTiles(conversationId) {
        const tileIds = this.conversationIndex.get(conversationId) || new Set();
        return Array.from(tileIds).map(id => this.dataTiles.get(id)).filter(Boolean);
    }

    // Get occupied column pairs (for conversation territory)
    getOccupiedColumnPairs() {
        const occupiedPairs = new Set();
        
        for (const tile of this.dataTiles.values()) {
            const startQ = Math.floor(tile.position.q / 2) * 2;
            occupiedPairs.add(startQ);
        }
        
        return occupiedPairs;
    }

    // Check if column pair is available for new conversation
    isColumnPairAvailable(q) {
        const startQ = Math.floor(q / 2) * 2;
        const occupiedPairs = this.getOccupiedColumnPairs();
        return !occupiedPairs.has(startQ);
    }

    // Calculate next position in conversation for new data tile
    getNextConversationPosition(conversationId) {
        const tiles = this.getConversationTiles(conversationId);
        if (tiles.length === 0) return null;
        
        // Get conversation start position
        const firstTile = tiles[0];
        const startQ = Math.floor(firstTile.position.q / 2) * 2;
        const startR = firstTile.position.r;
        
        // Calculate next position based on tile count
        const tileCount = tiles.length;
        const isLeft = tileCount % 2 === 0;
        const rowOffset = Math.floor(tileCount / 2);
        
        return {
            q: startQ + (isLeft ? 0 : 1),
            r: startR + rowOffset
        };
    }

    // Get all tiles for rendering
    getAllTiles() {
        return {
            dataTiles: Array.from(this.dataTiles.values()),
            uiTiles: Array.from(this.uiTiles.values())
        };
    }

    // Private methods
    _indexPosition(tile) {
        const key = `${tile.position.q},${tile.position.r}`;
        if (!this.positionIndex.has(key)) {
            this.positionIndex.set(key, new Set());
        }
        this.positionIndex.get(key).add(tile.id);
    }

    _unindexPosition(tile) {
        const key = `${tile.position.q},${tile.position.r}`;
        const tileSet = this.positionIndex.get(key);
        if (tileSet) {
            tileSet.delete(tile.id);
            if (tileSet.size === 0) {
                this.positionIndex.delete(key);
            }
        }
    }
}

// Create singleton instance
const tileGrid = new TileGrid();
export default tileGrid;