
class AnimationManager {
    constructor(initialViewState, onUpdateCallback) {
        this.viewState = { ...initialViewState };
        this.velocity = { x: 0, y: 0 };
        this.onUpdateCallback = onUpdateCallback;
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        this.isLocked = false; // Managed by the UI, but needed for animation logic

        // Spring-bounce viewport bounds relative to grid center
        this.bounds = {
            enabled: true,
            centerX: 0, // Grid center X - will be updated
            centerY: 0, // Grid center Y - will be updated
            maxDistance: 0 // Maximum distance from center before spring-bounce
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

    updateBounds(gridCenter = null) {
        if (typeof window !== 'undefined') {
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            
            // Use provided grid center or default to screen center
            const centerX = gridCenter?.x || screenWidth / 2;
            const centerY = gridCenter?.y || screenHeight / 2;
            
            // Base distance of 1600px at 100% zoom, scaled by zoom level
            const baseDistance = 1600;
            const currentZoom = this.viewState.zoom || 1;
            const maxDistance = baseDistance / currentZoom;
            
            this.bounds = {
                ...this.bounds,
                centerX,
                centerY,
                maxDistance
            };
        }
    }

    applyElasticBounds(x, y, deltaTime) {
        if (!this.bounds.enabled) return { x, y, elasticForce: { x: 0, y: 0 } };
        
        // Calculate distance from grid center
        const dx = x - this.bounds.centerX;
        const dy = y - this.bounds.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        let elasticForceX = 0;
        let elasticForceY = 0;
        
        // If we're outside the allowed bounds, apply elastic resistance
        if (distance > this.bounds.maxDistance) {
            // How far over the boundary we are
            const overDistance = distance - this.bounds.maxDistance;
            
            // Elastic force grows progressively stronger the further out we go
            // Using a gentle exponential curve for smooth feel
            const elasticStrength = Math.min(overDistance * 0.008, 3.0); // Progressive resistance
            
            // Direction back toward center
            const directionX = -dx / distance;
            const directionY = -dy / distance;
            
            // Apply elastic force - stronger the further you go
            elasticForceX = directionX * elasticStrength;
            elasticForceY = directionY * elasticStrength;
        }
        
        return { 
            x, 
            y, 
            elasticForce: { x: elasticForceX, y: elasticForceY }
        };
    }

    animate(currentTime) {
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // Apply velocity to viewState
        let newX = this.viewState.x + (this.isLocked ? 0 : this.velocity.x * (deltaTime / 16.66));
        let newY = this.viewState.y + (this.velocity.y * (deltaTime / 16.66));

        // Apply elastic bounds and get elastic forces
        const elasticResult = this.applyElasticBounds(newX, newY, deltaTime);
        this.viewState.x = elasticResult.x;
        this.viewState.y = elasticResult.y;
        
        // Add elastic forces to velocity for smooth elastic feel
        if (!this.isLocked) {
            this.velocity.x += elasticResult.elasticForce.x;
        }
        this.velocity.y += elasticResult.elasticForce.y;

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
        
        // Update position directly during drag - spring bounds will be applied in animation
        this.viewState.x = newX;
        this.viewState.y = newY;
        
        this.onUpdateCallback({ ...this.viewState });
    }

    setZoom(newZoom, mouseX, mouseY, screenCenter) {
        const worldX = (mouseX - this.viewState.x) / this.viewState.zoom;
        const worldY = (mouseY - this.viewState.y) / this.viewState.zoom;

        let newX = mouseX - worldX * newZoom;
        let newY = mouseY - worldY * newZoom;
        
        // Set position directly - spring bounds will be handled in animation if needed
        this.viewState.x = newX;
        this.viewState.y = newY;
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
