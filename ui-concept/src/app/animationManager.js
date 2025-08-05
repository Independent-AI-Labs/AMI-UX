
class AnimationManager {
    constructor(initialViewState, onUpdateCallback) {
        this.viewState = { ...initialViewState };
        this.velocity = { x: 0, y: 0, zoom: 0 };
        this.targetZoom = initialViewState.zoom || 1;
        this.targetPosition = { x: initialViewState.x || 0, y: initialViewState.y || 0 };
        this.zoomOrigin = { x: 0, y: 0 };
        this.onUpdateCallback = onUpdateCallback;
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        this.isLocked = false; // Managed by the UI, but needed for animation logic

        this.animate = this.animate.bind(this);
    }

    start() {
        console.log('[AnimationManager] start() called');
        if (!this.animationFrameId) {
            this.lastFrameTime = performance.now();
            this.animationFrameId = requestAnimationFrame(this.animate);
            console.log('[AnimationManager] Animation started');
        } else {
            console.log('[AnimationManager] Animation already running');
        }
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }


    animate(currentTime) {
        console.log('[AnimationManager] animate() called');
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        let hasChanges = false;

        // Handle position animation to target
        const xDiff = this.targetPosition.x - this.viewState.x;
        const yDiff = this.targetPosition.y - this.viewState.y;
        
        if (Math.abs(xDiff) > 0.1 || Math.abs(yDiff) > 0.1) {
            console.log('[AnimationManager] Animating position:', { xDiff, yDiff });
            // Exponential ease-out to target position
            this.viewState.x += xDiff * 0.12;
            this.viewState.y += yDiff * 0.12;
            hasChanges = true;
            
            // Snap if very close
            if (Math.abs(xDiff) < 1) this.viewState.x = this.targetPosition.x;
            if (Math.abs(yDiff) < 1) this.viewState.y = this.targetPosition.y;
        }

        // Also apply any velocity (for dragging)
        if (!this.isLocked && (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.y) > 0.01)) {
            this.viewState.x += this.velocity.x * (deltaTime / 16.66);
            this.viewState.y += this.velocity.y * (deltaTime / 16.66);
            
            // Update target to match drag
            this.targetPosition.x = this.viewState.x;
            this.targetPosition.y = this.viewState.y;
            
            // Apply decay
            const decayFactor = Math.pow(0.92, deltaTime / 16.66);
            this.velocity.x *= decayFactor;
            this.velocity.y *= decayFactor;
            hasChanges = true;
        }

        // Handle zoom animation
        const zoomDiff = this.targetZoom - this.viewState.zoom;
        if (Math.abs(zoomDiff) > 0.0001) {
            const oldZoom = this.viewState.zoom;
            
            // Simple exponential ease-out
            const zoomDelta = zoomDiff * 0.12;
            
            // If we're very close, just set it to avoid micro-movements
            if (Math.abs(zoomDiff) < 0.005) {
                this.viewState.zoom = this.targetZoom;
            } else {
                this.viewState.zoom += zoomDelta;
            }
            
            // Adjust position to keep zoom origin point fixed
            const scale = this.viewState.zoom / oldZoom;
            this.viewState.x = this.zoomOrigin.x - (this.zoomOrigin.x - this.viewState.x) * scale;
            this.viewState.y = this.zoomOrigin.y - (this.zoomOrigin.y - this.viewState.y) * scale;
            
            // Update target position to match zoom adjustment
            this.targetPosition.x = this.viewState.x;
            this.targetPosition.y = this.viewState.y;
            hasChanges = true;
        }

        // Stop animation if no changes
        if (!hasChanges) {
            this.stop();
        } else {
            this.animationFrameId = requestAnimationFrame(this.animate);
        }

        // Notify UI of update
        this.onUpdateCallback({ ...this.viewState });
    }

    // Public methods to be called by UI event handlers
    setInitialVelocity(x, y) {
        this.velocity.x = x;
        this.velocity.y = y;
        this.start();
    }

    updatePosition(deltaX, deltaY) {
        let newX = this.viewState.x + deltaX;
        let newY = this.viewState.y + deltaY;
        
        // Update position directly during drag
        this.viewState.x = newX;
        this.viewState.y = newY;
        
        // Also update target to prevent animation back
        this.targetPosition.x = newX;
        this.targetPosition.y = newY;
        
        this.onUpdateCallback({ ...this.viewState });
    }

    setZoom(newZoom, mouseX, mouseY, screenCenter) {
        // Set target zoom and origin for smooth animation
        this.targetZoom = newZoom;
        this.zoomOrigin = { x: mouseX, y: mouseY };
        
        this.start();
    }

    setLocked(locked) {
        console.log('[AnimationManager] setLocked called with:', locked);
        this.isLocked = locked;
        if (locked) {
            this.velocity = { x: 0, y: 0, zoom: 0 }; // Stop any velocity-based movement
            // Don't stop the animation or reset targets - we want to animate to the locked position
        }
    }

    reset() {
        this.viewState = { x: 0, y: 0, zoom: 1 };
        this.targetPosition = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0, zoom: 0 };
        this.targetZoom = 1;
        this.stop();
        this.onUpdateCallback({ ...this.viewState });
    }

    // Method for lockToConversation to animate to new viewState
    setViewState(newViewState) {
        console.log('[AnimationManager] setViewState called with:', newViewState);
        console.log('[AnimationManager] Current state:', this.viewState);
        console.log('[AnimationManager] Current targets:', { x: this.targetPosition.x, y: this.targetPosition.y, zoom: this.targetZoom });
        
        // Always update target zoom if provided
        if (newViewState.zoom !== undefined) {
            this.targetZoom = newViewState.zoom;
            // Calculate zoom origin as the center of the screen
            this.zoomOrigin = { 
                x: (typeof window !== 'undefined' ? window.innerWidth / 2 : 0), 
                y: (typeof window !== 'undefined' ? window.innerHeight / 2 : 0) 
            };
        }
        
        // Update target position if provided
        if (newViewState.x !== undefined) {
            this.targetPosition.x = newViewState.x;
        }
        
        if (newViewState.y !== undefined) {
            this.targetPosition.y = newViewState.y;
        }
        
        console.log('[AnimationManager] New targets:', { x: this.targetPosition.x, y: this.targetPosition.y, zoom: this.targetZoom });
        
        this.start();
    }
}

export default AnimationManager;
