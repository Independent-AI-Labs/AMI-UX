
class AnimationManager {
    constructor(initialViewState, onUpdateCallback) {
        this.viewState = { ...initialViewState };
        this.velocity = { x: 0, y: 0, zoom: 0 };
        this.targetZoom = initialViewState.zoom || 1;
        this.zoomOrigin = { x: 0, y: 0 };
        this.onUpdateCallback = onUpdateCallback;
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        this.isLocked = false; // Managed by the UI, but needed for animation logic

        this.animate = this.animate.bind(this);
    }

    start() {
        if (!this.animationFrameId) {
            this.lastFrameTime = performance.now();
            this.animationFrameId = requestAnimationFrame(this.animate);
        }
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }


    animate(currentTime) {
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // Apply velocity to viewState
        this.viewState.x += this.isLocked ? 0 : this.velocity.x * (deltaTime / 16.66);
        this.viewState.y += this.velocity.y * (deltaTime / 16.66);

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
        }

        // Apply decay to velocity
        const decayFactor = Math.pow(0.92, deltaTime / 16.66);
        this.velocity.x = this.isLocked ? 0 : this.velocity.x * decayFactor;
        this.velocity.y = this.velocity.y * decayFactor;

        // Stop animation if all velocities are very small
        const shouldStop = Math.abs(this.velocity.x) < 0.05 && 
                          Math.abs(this.velocity.y) < 0.05 && 
                          Math.abs(this.targetZoom - this.viewState.zoom) < 0.0001;
                          
        if (shouldStop) {
            this.velocity = { x: 0, y: 0, zoom: 0 };
            // Don't snap - we already handled this above
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
        
        // Update position directly during drag - spring bounds will be applied in animation
        this.viewState.x = newX;
        this.viewState.y = newY;
        
        this.onUpdateCallback({ ...this.viewState });
    }

    setZoom(newZoom, mouseX, mouseY, screenCenter) {
        // Set target zoom and origin for smooth animation
        this.targetZoom = newZoom;
        this.zoomOrigin = { x: mouseX, y: mouseY };
        
        this.start();
    }

    setLocked(locked) {
        this.isLocked = locked;
        if (locked) {
            this.velocity = { x: 0, y: 0, zoom: 0 }; // Stop any ongoing animation
            this.targetZoom = this.viewState.zoom; // Stop zoom animation
            this.stop();
        }
    }

    reset() {
        this.viewState = { x: 0, y: 0, zoom: 1 };
        this.velocity = { x: 0, y: 0, zoom: 0 };
        this.targetZoom = 1;
        this.stop();
        this.onUpdateCallback({ ...this.viewState });
    }

    // Method for lockToConversation to animate to new viewState
    setViewState(newViewState) {
        // Always update target zoom if provided
        if (newViewState.zoom !== undefined) {
            this.targetZoom = newViewState.zoom;
            // Calculate zoom origin as the center of the screen
            this.zoomOrigin = { 
                x: (typeof window !== 'undefined' ? window.innerWidth / 2 : 0), 
                y: (typeof window !== 'undefined' ? window.innerHeight / 2 : 0) 
            };
        }
        
        // Always update target position if provided
        if (newViewState.x !== undefined) {
            // For position, we'll use velocity-based animation
            const dx = (newViewState.x - this.viewState.x) * 0.15;
            this.velocity.x = dx;
        }
        
        if (newViewState.y !== undefined) {
            const dy = (newViewState.y - this.viewState.y) * 0.15;
            this.velocity.y = dy;
        }
        
        this.start();
    }
}

export default AnimationManager;
