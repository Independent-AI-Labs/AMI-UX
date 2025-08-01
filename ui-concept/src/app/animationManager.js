
class AnimationManager {
    constructor(initialViewState, onUpdateCallback) {
        this.viewState = { ...initialViewState };
        this.velocity = { x: 0, y: 0 };
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
        this.viewState.x += deltaX;
        this.viewState.y += deltaY;
        this.onUpdateCallback({ ...this.viewState });
    }

    setZoom(newZoom, mouseX, mouseY, screenCenter) {
        const worldX = (mouseX - this.viewState.x) / this.viewState.zoom;
        const worldY = (mouseY - this.viewState.y) / this.viewState.zoom;

        this.viewState.x = mouseX - worldX * newZoom;
        this.viewState.y = mouseY - worldY * newZoom;
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
