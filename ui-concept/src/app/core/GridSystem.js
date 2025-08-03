/**
 * Grid System - Unified coordinate system and data model
 * 
 * Coordinate Spaces:
 * 1. Grid Space: Integer hex coordinates (q, r) 
 * 2. World Space: Pixel coordinates in the infinite world
 * 3. Screen Space: Pixel coordinates on the viewport
 * 
 * Grid Layout: Rectangular 32x16 hex grid
 * - q: 0 to 31 (columns)
 * - r: 0 to 15 (rows)
 * - Origin at (0,0) top-left
 */

export class GridSystem {
    constructor(hexSize = 180) {
        this.hexSize = hexSize;
        this.gridCols = 32;
        this.gridRows = 16;
        
        // Hex geometry constants
        this.hexWidth = hexSize * 2;
        this.hexHeight = Math.sqrt(3) * hexSize;
        this.hexSpacingX = hexSize * 1.5; // Horizontal spacing between hex centers
        this.hexSpacingY = this.hexHeight; // Vertical spacing between hex centers
        
        // Grid bounds in world space
        this.gridBounds = this.calculateGridBounds();
    }
    
    /**
     * Convert grid coordinates to world coordinates
     * @param {number} q - Grid column (0-31)
     * @param {number} r - Grid row (0-15)
     * @returns {object} {x, y} in world space
     */
    gridToWorld(q, r) {
        // Proper hex grid layout with alternating column offset
        // Even columns (0,2,4...) have offset 0, odd columns (1,3,5...) have offset -0.5
        const x = q * this.hexSpacingX;
        const y = r * this.hexSpacingY + (q % 2) * (-this.hexSpacingY / 2);
        return { x, y };
    }
    
    /**
     * Convert world coordinates to grid coordinates
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     * @returns {object} {q, r} grid coordinates
     */
    worldToGrid(x, y) {
        // Inverse of hex grid layout with proper offset
        const q = Math.round(x / this.hexSpacingX);
        const r = Math.round((y - (q % 2) * (-this.hexSpacingY / 2)) / this.hexSpacingY);
        return { q, r };
    }
    
    /**
     * Check if grid coordinates are within valid bounds
     * @param {number} q - Grid column
     * @param {number} r - Grid row
     * @returns {boolean}
     */
    isValidGridPosition(q, r) {
        return q >= 0 && q < this.gridCols && r >= 0 && r < this.gridRows;
    }
    
    /**
     * Get all valid grid positions
     * @returns {Array} Array of {q, r} coordinates
     */
    getAllGridPositions() {
        const positions = [];
        for (let q = 0; q < this.gridCols; q++) {
            for (let r = 0; r < this.gridRows; r++) {
                positions.push({ q, r });
            }
        }
        return positions;
    }
    
    /**
     * Calculate grid bounds in world space
     * @returns {object} {minX, maxX, minY, maxY, width, height}
     */
    calculateGridBounds() {
        const positions = this.getAllGridPositions();
        const worldPositions = positions.map(pos => this.gridToWorld(pos.q, pos.r));
        
        const minX = Math.min(...worldPositions.map(p => p.x)) - this.hexSize;
        const maxX = Math.max(...worldPositions.map(p => p.x)) + this.hexSize;
        const minY = Math.min(...worldPositions.map(p => p.y)) - this.hexSize;
        const maxY = Math.max(...worldPositions.map(p => p.y)) + this.hexSize;
        
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    /**
     * Get grid positions visible in viewport
     * @param {object} viewport - {x, y, zoom, screenWidth, screenHeight}
     * @returns {Array} Array of {q, r, worldX, worldY, screenX, screenY}
     */
    getVisiblePositions(viewport) {
        const { x: viewX, y: viewY, zoom, screenWidth, screenHeight } = viewport;
        
        // Calculate world space bounds of viewport
        const worldLeft = (-viewX) / zoom;
        const worldRight = (screenWidth - viewX) / zoom;
        const worldTop = (-viewY) / zoom;
        const worldBottom = (screenHeight - viewY) / zoom;
        
        const visiblePositions = [];
        
        for (let q = 0; q < this.gridCols; q++) {
            for (let r = 0; r < this.gridRows; r++) {
                const worldPos = this.gridToWorld(q, r);
                
                // Check if hex is visible (with margin for hex size)
                const margin = this.hexSize;
                if (worldPos.x >= worldLeft - margin && worldPos.x <= worldRight + margin &&
                    worldPos.y >= worldTop - margin && worldPos.y <= worldBottom + margin) {
                    
                    // Calculate screen position
                    const screenX = viewX + worldPos.x * zoom;
                    const screenY = viewY + worldPos.y * zoom;
                    
                    visiblePositions.push({
                        q,
                        r,
                        worldX: worldPos.x,
                        worldY: worldPos.y,
                        screenX,
                        screenY
                    });
                }
            }
        }
        
        return visiblePositions;
    }
}

// Singleton instance
export const gridSystem = new GridSystem();
export default gridSystem;