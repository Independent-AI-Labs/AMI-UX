/**
 * Viewport System - Manages coordinate transformations and viewport state
 * 
 * Provides consistent coordinate space transformations:
 * - Screen to World
 * - World to Screen
 * - Viewport bounds management
 * - Zoom and pan constraints
 */

import gridSystem from './GridSystem';

export class ViewportSystem {
    constructor() {
        this.viewState = {
            x: 0,      // World offset X
            y: 0,      // World offset Y
            zoom: 1    // Zoom level
        };
        
        this.screenDimensions = {
            width: typeof window !== 'undefined' ? window.innerWidth : 1920,
            height: typeof window !== 'undefined' ? window.innerHeight : 1080
        };
        
        // Viewport constraints
        this.constraints = {
            minZoom: 0.1,
            maxZoom: 3.0,
            maxPanDistance: 2000 // pixels from grid center
        };
    }
    
    /**
     * Update viewport state
     * @param {object} newState - {x?, y?, zoom?}
     */
    updateViewState(newState) {
        this.viewState = { ...this.viewState, ...newState };
        this.enforceConstraints();
    }
    
    /**
     * Update screen dimensions
     * @param {number} width 
     * @param {number} height 
     */
    updateScreenDimensions(width, height) {
        this.screenDimensions = { width, height };
    }
    
    /**
     * Convert screen coordinates to world coordinates
     * @param {number} screenX 
     * @param {number} screenY 
     * @returns {object} {x, y} in world space
     */
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.viewState.x) / this.viewState.zoom;
        const worldY = (screenY - this.viewState.y) / this.viewState.zoom;
        return { x: worldX, y: worldY };
    }
    
    /**
     * Convert world coordinates to screen coordinates
     * @param {number} worldX 
     * @param {number} worldY 
     * @returns {object} {x, y} in screen space
     */
    worldToScreen(worldX, worldY) {
        const screenX = this.viewState.x + worldX * this.viewState.zoom;
        const screenY = this.viewState.y + worldY * this.viewState.zoom;
        return { x: screenX, y: screenY };
    }
    
    /**
     * Get current viewport info
     * @returns {object} Complete viewport state
     */
    getViewportInfo() {
        return {
            ...this.viewState,
            ...this.screenDimensions,
            worldBounds: this.getWorldBounds(),
            gridBounds: gridSystem.gridBounds
        };
    }
    
    /**
     * Get world space bounds of current viewport
     * @returns {object} {left, right, top, bottom, width, height}
     */
    getWorldBounds() {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.screenDimensions.width, this.screenDimensions.height);
        
        return {
            left: topLeft.x,
            right: bottomRight.x,
            top: topLeft.y,
            bottom: bottomRight.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }
    
    /**
     * Center viewport on grid
     */
    centerOnGrid() {
        const gridCenter = gridSystem.gridBounds;
        const screenCenter = {
            x: this.screenDimensions.width / 2,
            y: this.screenDimensions.height / 2
        };
        
        this.updateViewState({
            x: screenCenter.x - gridCenter.centerX * this.viewState.zoom,
            y: screenCenter.y - gridCenter.centerY * this.viewState.zoom
        });
    }
    
    /**
     * Pan viewport by screen space delta
     * @param {number} deltaX 
     * @param {number} deltaY 
     */
    pan(deltaX, deltaY) {
        this.updateViewState({
            x: this.viewState.x + deltaX,
            y: this.viewState.y + deltaY
        });
    }
    
    /**
     * Zoom viewport around a screen point
     * @param {number} newZoom 
     * @param {number} screenX - Point to zoom around
     * @param {number} screenY - Point to zoom around
     */
    zoomAround(newZoom, screenX, screenY) {
        // Calculate world point that should stay fixed
        const worldPoint = this.screenToWorld(screenX, screenY);
        
        // Update zoom
        const constrainedZoom = Math.max(this.constraints.minZoom, 
                                       Math.min(this.constraints.maxZoom, newZoom));
        
        // Calculate new view position to keep world point fixed
        const newX = screenX - worldPoint.x * constrainedZoom;
        const newY = screenY - worldPoint.y * constrainedZoom;
        
        this.updateViewState({
            x: newX,
            y: newY,
            zoom: constrainedZoom
        });
    }
    
    /**
     * Enforce viewport constraints
     */
    enforceConstraints() {
        // Constrain zoom
        this.viewState.zoom = Math.max(this.constraints.minZoom, 
                                     Math.min(this.constraints.maxZoom, this.viewState.zoom));
        
        // Constrain pan distance from grid center
        const gridCenter = gridSystem.gridBounds;
        const screenCenter = {
            x: this.screenDimensions.width / 2,
            y: this.screenDimensions.height / 2
        };
        
        // Calculate ideal position for grid center to be at screen center
        const idealX = screenCenter.x - gridCenter.centerX * this.viewState.zoom;
        const idealY = screenCenter.y - gridCenter.centerY * this.viewState.zoom;
        
        // Calculate current distance from ideal
        const deltaX = this.viewState.x - idealX;
        const deltaY = this.viewState.y - idealY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Apply zoom-adjusted max distance constraint
        const maxDistance = this.constraints.maxPanDistance * this.viewState.zoom;
        
        if (distance > maxDistance) {
            // Constrain to max distance
            const ratio = maxDistance / distance;
            this.viewState.x = idealX + deltaX * ratio;
            this.viewState.y = idealY + deltaY * ratio;
        }
    }
}

// Singleton instance
export const viewportSystem = new ViewportSystem();
export default viewportSystem;