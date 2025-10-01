/**
 * Lock Manager - Centralized tile locking system
 * Uses a state machine pattern to manage lock states and transitions
 */

class LockManager {
    constructor() {
        // Current lock state
        this.state = {
            mode: 'free', // 'free', 'conversation', 'website'
            target: null,  // ID of locked target
            metadata: {}   // Additional data (position, etc.)
        };
        
        // Subscribers for state changes
        this.listeners = new Set();
        
        // View managers that need to be coordinated
        this.viewManagers = {
            animation: null,
            lod: null,
            hexToPixel: null,
            screenCenter: null
        };
        
        // Lock request queue to handle rapid clicks
        this.lockQueue = [];
        this.isProcessing = false;
    }
    
    /**
     * Initialize the lock manager with required dependencies
     */
    initialize(animationManager, lodManager, hexToPixel, screenCenter, tileGrid) {
        this.viewManagers.animation = animationManager;
        this.viewManagers.lod = lodManager;
        this.viewManagers.hexToPixel = hexToPixel;
        this.viewManagers.screenCenter = screenCenter;
        this.viewManagers.tileGrid = tileGrid;
        console.log('[LockManager] Initialized with:', {
            hasAnimation: !!animationManager,
            hasLod: !!lodManager,
            hasHexToPixel: !!hexToPixel,
            screenCenter,
            hasTileGrid: !!tileGrid
        });
    }
    
    /**
     * Get current lock state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Check lock status
     */
    get isLocked() {
        return this.state.mode !== 'free';
    }
    
    get isConversationLocked() {
        return this.state.mode === 'conversation';
    }
    
    get isWebsiteLocked() {
        return this.state.mode === 'website';
    }
    
    get lockedTarget() {
        return this.state.target;
    }
    
    /**
     * Request a lock on a conversation
     */
    requestConversationLock(conversationId, messageId, q, r) {
        console.log(`[LockManager] Requesting conversation lock: ${conversationId}`);
        
        const request = {
            type: 'conversation',
            target: conversationId,
            metadata: { messageId, q, r },
            timestamp: Date.now()
        };
        
        this.processLockRequest(request);
    }
    
    /**
     * Request a lock on a website
     */
    requestWebsiteLock(websiteId, q, r) {
        console.log(`[LockManager] Requesting website lock: ${websiteId}`);
        
        const request = {
            type: 'website',
            target: websiteId,
            metadata: { q, r },
            timestamp: Date.now()
        };
        
        this.processLockRequest(request);
    }
    
    /**
     * Request unlock
     */
    requestUnlock() {
        console.log(`[LockManager] Requesting unlock from: ${this.state.mode}`);
        
        const request = {
            type: 'unlock',
            target: null,
            metadata: {},
            timestamp: Date.now()
        };
        
        this.processLockRequest(request);
    }
    
    /**
     * Process a lock request
     */
    async processLockRequest(request) {
        // Add to queue
        this.lockQueue.push(request);
        
        // If already processing, wait
        if (this.isProcessing) {
            console.log('[LockManager] Already processing, request queued');
            return;
        }
        
        // Process queue
        while (this.lockQueue.length > 0) {
            this.isProcessing = true;
            
            // Get the most recent request of each type
            const latestRequest = this.lockQueue.pop();
            this.lockQueue = []; // Clear remaining queue
            
            try {
                await this.executeTransition(latestRequest);
            } catch (error) {
                console.error('[LockManager] Transition error:', error);
            }
            
            // Small delay to ensure state settles
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.isProcessing = false;
    }
    
    /**
     * Execute a state transition
     */
    async executeTransition(request) {
        const { type, target, metadata } = request;
        const currentMode = this.state.mode;
        
        console.log(`[LockManager] Transitioning from ${currentMode} to ${type}`);
        
        // Handle unlock request
        if (type === 'unlock') {
            if (currentMode === 'free') {
                console.log('[LockManager] Already unlocked, skipping');
                return;
            }
            
            this.performUnlock();
            return;
        }
        
        // Handle lock requests
        
        // If trying to lock to the same target, skip
        if (currentMode === type && this.state.target === target) {
            console.log('[LockManager] Already locked to this target, skipping');
            return;
        }
        
        // Unlock first if switching targets
        if (currentMode !== 'free') {
            this.performUnlock();
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        // Now perform the lock
        if (type === 'conversation') {
            this.performConversationLock(target, metadata);
        } else if (type === 'website') {
            this.performWebsiteLock(target, metadata);
        }
    }
    
    /**
     * Perform unlock operations
     */
    performUnlock() {
        console.log('[LockManager] Performing unlock');
        
        // Reset view managers
        try {
            if (this.viewManagers.lod) {
                this.viewManagers.lod.unlock();
                this.viewManagers.lod.returnToWorkspace();
            }
        } catch (e) {
            console.error('[LockManager] Error unlocking LoD:', e);
        }
        
        try {
            if (this.viewManagers.animation?.current) {
                this.viewManagers.animation.current.setLocked(false);
            }
        } catch (e) {
            console.error('[LockManager] Error unlocking animation:', e);
        }
        
        // Update state
        const oldState = { ...this.state };
        this.state = {
            mode: 'free',
            target: null,
            metadata: {}
        };
        
        // Notify listeners
        this.notifyListeners(oldState, this.state);
    }
    
    /**
     * Perform conversation lock
     */
    performConversationLock(conversationId, metadata) {
        console.log(`[LockManager] Locking to conversation: ${conversationId}`);
        
        const { messageId, q, r } = metadata;
        
        try {
            // Update LoD manager
            if (this.viewManagers.lod) {
                this.viewManagers.lod.lockToConversation(conversationId, messageId);
            }
            
            // Calculate and set view position
            if (this.viewManagers.animation?.current && this.viewManagers.hexToPixel && this.viewManagers.screenCenter) {
                const zoom = 1.8;
                
                // Get ALL tiles for this conversation to find the actual columns used
                const conversationTiles = this.viewManagers.tileGrid?.getConversationTiles(conversationId) || [];

                // Find the min and max Q values to determine the column pair
                let minQ = q;
                let maxQ = q;

                if (conversationTiles.length > 0) {
                    conversationTiles.forEach(tile => {
                        if (tile.position.q < minQ) minQ = tile.position.q;
                        if (tile.position.q > maxQ) maxQ = tile.position.q;
                    });
                } else {
                    // No tiles in conversation - cannot determine position
                    console.error(`[LockManager] Cannot lock to conversation: No tiles found for conversation ${conversationId}`);
                    // TODO: Show user-facing error toast/notification
                    throw new Error(`Cannot lock to empty conversation ${conversationId}`);
                }
                
                console.log('[LockManager] Conversation columns:', { conversationId, minQ, maxQ, tileCount: conversationTiles.length });
                
                // Get positions using row 0 for consistent X (no hex offset)
                const leftPos = this.viewManagers.hexToPixel(minQ, 0);
                const rightPos = this.viewManagers.hexToPixel(maxQ, 0);
                
                // Center X between the actual columns
                const conversationCenterX = (leftPos.x + rightPos.x) / 2;
                
                // For Y, use the clicked row
                const conversationCenterY = this.viewManagers.hexToPixel(minQ, r).y;
                
                const newX = this.viewManagers.screenCenter.x - (conversationCenterX * zoom);
                const newY = this.viewManagers.screenCenter.y - (conversationCenterY * zoom);
                
                this.viewManagers.animation.current.setViewState({
                    x: newX,
                    y: newY,
                    zoom: zoom
                });
                this.viewManagers.animation.current.setLocked(true);
            }
        } catch (e) {
            console.error('[LockManager] Error during conversation lock:', e);
        }
        
        // Update state
        const oldState = { ...this.state };
        this.state = {
            mode: 'conversation',
            target: conversationId,
            metadata: { messageId, q, r }
        };
        
        // Notify listeners
        this.notifyListeners(oldState, this.state);
    }
    
    /**
     * Perform website lock
     */
    performWebsiteLock(websiteId, metadata) {
        console.log(`[LockManager] Locking to website: ${websiteId}`, metadata);
        
        const { q, r } = metadata;
        
        try {
            // Calculate and set view position
            if (!this.viewManagers.animation?.current) {
                console.error('[LockManager] Animation manager not available');
                return;
            }
            if (!this.viewManagers.hexToPixel) {
                console.error('[LockManager] hexToPixel function not available');
                return;
            }
            if (!this.viewManagers.screenCenter) {
                console.error('[LockManager] screenCenter not available');
                return;
            }
            
            const tileCenter = this.viewManagers.hexToPixel(q, r);
            const zoom = 1.8;
            
            console.log('[LockManager] Calculated tile center:', tileCenter);
            console.log('[LockManager] Screen center:', this.viewManagers.screenCenter);
            
            const newX = this.viewManagers.screenCenter.x - (tileCenter.x * zoom);
            const newY = this.viewManagers.screenCenter.y - (tileCenter.y * zoom);
            
            console.log('[LockManager] Setting view state:', { x: newX, y: newY, zoom });
            
            this.viewManagers.animation.current.setViewState({
                x: newX,
                y: newY,
                zoom: zoom
            });
            this.viewManagers.animation.current.setLocked(true);
        } catch (e) {
            console.error('[LockManager] Error during website lock:', e);
            console.error('[LockManager] Stack:', e.stack);
        }
        
        // Update state
        const oldState = { ...this.state };
        this.state = {
            mode: 'website',
            target: websiteId,
            metadata: { q, r }
        };
        
        console.log('[LockManager] State updated from:', oldState, 'to:', this.state);
        
        // Notify listeners
        this.notifyListeners(oldState, this.state);
    }
    
    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    /**
     * Notify all listeners of state change
     */
    notifyListeners(oldState, newState) {
        this.listeners.forEach(callback => {
            try {
                callback(oldState, newState);
            } catch (error) {
                console.error('[LockManager] Listener error:', error);
            }
        });
    }
    
    /**
     * Check if a specific target is locked
     */
    isTargetLocked(type, targetId) {
        return this.state.mode === type && this.state.target === targetId;
    }
}

// Create singleton instance
const lockManager = new LockManager();
export default lockManager;