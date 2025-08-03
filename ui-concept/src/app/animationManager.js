
class AnimationManager {
    constructor(initialViewState, onUpdateCallback) {
        this.viewState = { ...initialViewState };
        this.velocity = { x: 0, y: 0 };
        this.onUpdateCallback = onUpdateCallback;
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        this.isLocked = false; // Managed by the UI, but needed for animation logic

        // Viewport bounds based on 200% background video size
        this.bounds = {
            enabled: true,
            maxX: 0, // Will be calculated based on screen size
            minX: 0,
            maxY: 0,
            minY: 0
        };

        this.animate = this.animate.bind(this);
        this.updateBounds();
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

    updateBounds() {
        if (typeof window !== 'undefined') {
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            
            // The background video is 200% size, so we can pan up to 50% of screen size in each direction
            // from the center position (which is where the 100% video would be centered)
            const centerX = screenWidth / 2;
            const centerY = screenHeight / 2;
            
            // Allow panning 25% of screen size in each direction (50% total range)
            const maxPanX = screenWidth * 0.25;
            const maxPanY = screenHeight * 0.25;
            
            this.bounds = {
                ...this.bounds,
                maxX: centerX + maxPanX,
                minX: centerX - maxPanX,
                maxY: centerY + maxPanY,
                minY: centerY - maxPanY
            };
        }
    }

    constrainToBounds(x, y) {
        if (!this.bounds.enabled) return { x, y };
        
        return {
            x: Math.max(this.bounds.minX, Math.min(this.bounds.maxX, x)),
            y: Math.max(this.bounds.minY, Math.min(this.bounds.maxY, y))
        };
    }

    animate(currentTime) {
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // Apply velocity to viewState
        let newX = this.viewState.x + (this.isLocked ? 0 : this.velocity.x * (deltaTime / 16.66));
        let newY = this.viewState.y + (this.velocity.y * (deltaTime / 16.66));

        // Apply bounds constraint
        const constrained = this.constrainToBounds(newX, newY);
        this.viewState.x = constrained.x;
        this.viewState.y = constrained.y;

        // Apply decay to velocity
        const decayFactor = Math.pow(0.92, deltaTime / 16.66);
        this.velocity.x = this.isLocked ? 0 : this.velocity.x * decayFactor;
        this.velocity.y = this.velocity.y * decayFactor;

        // Stop animation if velocity is very small
        if (Math.abs(this.velocity.x) < 0.05 && Math.abs(this.velocity.y) < 0.05) {
            this.velocity = { x: 0, y: 0 };
            this.stop();
        } else {
            this.animationFrameId = requestAnimationFrame(this.animate);
        }

        // Notify UI of update
        this.onUpdateCallback({ ...this.viewState });
    }

    // Public methods to be called by UI event handlers
    setInitialVelocity(x, y) {
        this.velocity = { x, y };
        this.start();
    }

    updatePosition(deltaX, deltaY) {
        let newX = this.viewState.x + deltaX;
        let newY = this.viewState.y + deltaY;
        
        // Apply bounds constraint
        const constrained = this.constrainToBounds(newX, newY);
        this.viewState.x = constrained.x;
        this.viewState.y = constrained.y;
        
        this.onUpdateCallback({ ...this.viewState });
    }

    setZoom(newZoom, mouseX, mouseY, screenCenter) {
        const worldX = (mouseX - this.viewState.x) / this.viewState.zoom;
        const worldY = (mouseY - this.viewState.y) / this.viewState.zoom;

        let newX = mouseX - worldX * newZoom;
        let newY = mouseY - worldY * newZoom;
        
        // Apply bounds constraint
        const constrained = this.constrainToBounds(newX, newY);
        
        this.viewState.x = constrained.x;
        this.viewState.y = constrained.y;
        this.viewState.zoom = newZoom;
        this.onUpdateCallback({ ...this.viewState });
    }

    setLocked(locked) {
        this.isLocked = locked;
        if (locked) {
            this.velocity = { x: 0, y: 0 }; // Stop any ongoing pan animation
            this.stop();
        }
    }

    reset() {
        this.viewState = { x: 0, y: 0, zoom: 1 };
        this.velocity = { x: 0, y: 0 };
        this.stop();
        this.onUpdateCallback({ ...this.viewState });
    }

    // Method for lockToConversation to directly set viewState
    setViewState(newViewState) {
        this.viewState = { ...newViewState };
        this.onUpdateCallback({ ...this.viewState });
    }
}

export default AnimationManager;
