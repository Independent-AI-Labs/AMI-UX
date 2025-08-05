
class AnimationManager {
    constructor(initialViewState, onUpdateCallback) {
        this.viewState = { ...initialViewState };
        this.velocity = { x: 0, y: 0, zoom: 0 };
        this.targetZoom = initialViewState.zoom || 1;
        this.targetPosition = { x: initialViewState.x || 0, y: initialViewState.y || 0 };
        this.onUpdateCallback = onUpdateCallback;
        this.onAnimationComplete = null; // Callback for when animation finishes
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        this.isLocked = false; // Managed by the UI, but needed for animation logic
        this.wasAnimating = false; // Track animation state

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
        
        // Throttle to ~60fps to prevent excessive updates
        if (deltaTime < 16) {
            this.animationFrameId = requestAnimationFrame(this.animate);
            return;
        }
        
        this.lastFrameTime = currentTime;

        let hasChanges = false;
        const easing = 0.25; // Much faster animation

        // Simple interpolation to target camera state
        const xDiff = this.targetPosition.x - this.viewState.x;
        const yDiff = this.targetPosition.y - this.viewState.y;
        const zoomDiff = this.targetZoom - this.viewState.zoom;
        
        // Animate all properties together for smooth motion
        if (Math.abs(xDiff) > 0.1 || Math.abs(yDiff) > 0.1 || Math.abs(zoomDiff) > 0.0005) {
            this.viewState.x += xDiff * easing;
            this.viewState.y += yDiff * easing;
            this.viewState.zoom += zoomDiff * easing;
            hasChanges = true;
        } else {
            // Snap when very close
            if (xDiff !== 0) this.viewState.x = this.targetPosition.x;
            if (yDiff !== 0) this.viewState.y = this.targetPosition.y;
            if (zoomDiff !== 0) this.viewState.zoom = this.targetZoom;
            if (xDiff !== 0 || yDiff !== 0 || zoomDiff !== 0) hasChanges = true;
        }

        // Apply velocity for smooth dragging
        if (!this.isLocked && (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.y) > 0.01)) {
            this.viewState.x += this.velocity.x * (deltaTime / 16.66);
            this.viewState.y += this.velocity.y * (deltaTime / 16.66);
            
            // Update target to follow drag
            this.targetPosition.x = this.viewState.x;
            this.targetPosition.y = this.viewState.y;
            
            // Apply decay
            const decayFactor = Math.pow(0.92, deltaTime / 16.66);
            this.velocity.x *= decayFactor;
            this.velocity.y *= decayFactor;
            hasChanges = true;
        }

        // Stop animation if no changes
        if (!hasChanges) {
            this.stop();
            // If we were animating and now stopped, trigger completion callback
            if (this.wasAnimating && this.onAnimationComplete) {
                this.onAnimationComplete();
            }
            this.wasAnimating = false;
        } else {
            this.animationFrameId = requestAnimationFrame(this.animate);
            this.wasAnimating = true;
        }

        // Only notify UI if there were actual changes
        if (hasChanges || this.animationFrameId) {
            this.onUpdateCallback({ ...this.viewState });
        }
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
        // Clamp zoom
        newZoom = Math.max(0.125, Math.min(8, newZoom));
        
        // If zoom hasn't changed, don't do anything
        if (Math.abs(newZoom - this.targetZoom) < 0.0001) {
            return;
        }
        
        // Stop any velocity-based movement immediately
        this.velocity = { x: 0, y: 0, zoom: 0 };
        
        // Calculate the world point under the mouse using CURRENT actual state
        // Don't snap to target - just use where we actually are right now
        const worldX = (mouseX - this.viewState.x) / this.viewState.zoom;
        const worldY = (mouseY - this.viewState.y) / this.viewState.zoom;
        
        // Calculate new target position to keep the world point fixed
        const targetX = mouseX - (worldX * newZoom);
        const targetY = mouseY - (worldY * newZoom);
        
        // Update targets
        this.targetPosition.x = targetX;
        this.targetPosition.y = targetY;
        this.targetZoom = newZoom;
        
        this.start();
    }

    setLocked(locked) {
        this.isLocked = locked;
        if (locked) {
            this.velocity = { x: 0, y: 0, zoom: 0 }; // Stop any velocity-based movement
            // Don't stop the animation or reset targets - we want to animate to the locked position
        }
    }

    reset() {
        // Reset velocity immediately
        this.velocity = { x: 0, y: 0, zoom: 0 };
        
        // Use setViewState for animated reset
        this.setViewState({
            x: 0,
            y: 0,
            zoom: 1
        });
    }

    // Set target camera state
    setViewState(newViewState) {
        // Update any provided components of the camera state
        if (newViewState.x !== undefined) {
            this.targetPosition.x = newViewState.x;
        }
        
        if (newViewState.y !== undefined) {
            this.targetPosition.y = newViewState.y;
        }
        
        if (newViewState.zoom !== undefined) {
            this.targetZoom = newViewState.zoom;
        }
        
        this.start();
    }
}

export default AnimationManager;
