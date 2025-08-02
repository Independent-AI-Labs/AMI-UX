/**
 * Level of Detail (LoD) Manager
 * Manages both zoom-based LoD and context-based LoD as separate but connected concerns
 */

// Context-based LoD levels (data/interaction context)
export const CONTEXT_LEVELS = {
    WORKSPACE: 'workspace',     // Canvas level - no conversation locked
    CONVERSATION: 'conversation', // Conversation level - locked to a conversation
    MESSAGE: 'message'          // Message level - single message expanded to viewport
};

// Zoom-based LoD levels (visual detail based on zoom)
export const ZOOM_LEVELS = {
    OVERVIEW: 'overview',       // Very zoomed out - minimal detail
    NORMAL: 'normal',          // Normal zoom - full detail
    DETAIL: 'detail'           // Zoomed in - enhanced detail
};

// LoD configuration for each context level
const CONTEXT_CONFIG = {
    [CONTEXT_LEVELS.WORKSPACE]: {
        name: 'Workspace',
        description: 'Canvas overview with all conversations visible',
        allowPanning: true,
        allowZooming: true,
        showControls: true,
        showInstructions: true,
        hexTransparency: {
            message: { base: 0.15, hover: 0.25, locked: 0.3 },
            input: { base: 0.08, hover: 0.15, locked: 0.2 }
        },
        interactions: {
            hexClick: 'lockToConversation',
            contextMenu: true,
            gridSelection: true
        }
    },
    
    [CONTEXT_LEVELS.CONVERSATION]: {
        name: 'Conversation',
        description: 'Locked to a specific conversation thread',
        allowPanning: 'vertical', // Only vertical panning
        allowZooming: false,
        showControls: true,
        showInstructions: false,
        hexTransparency: {
            message: { base: 0.3, hover: 0.4, locked: 0.5 },
            input: { base: 0.2, hover: 0.3, locked: 0.4 }
        },
        interactions: {
            hexClick: 'expandToMessage',
            contextMenu: true,
            gridSelection: false,
            textSelection: true,
            messageActions: true
        }
    },
    
    [CONTEXT_LEVELS.MESSAGE]: {
        name: 'Message',
        description: 'Single message expanded to full viewport',
        allowPanning: false,
        allowZooming: false,
        showControls: false,
        showInstructions: false,
        hexTransparency: {
            message: { base: 0.6, hover: 0.7, locked: 0.8 },
            input: { base: 0.4, hover: 0.5, locked: 0.6 }
        },
        interactions: {
            hexClick: 'returnToConversation',
            contextMenu: true,
            gridSelection: false,
            textSelection: true,
            messageActions: true
        },
        layout: 'fullscreen'
    }
};

// Zoom-based LoD configuration
const ZOOM_CONFIG = {
    [ZOOM_LEVELS.OVERVIEW]: {
        name: 'Overview',
        zoomRange: [0.2, 0.6],
        showContent: 'placeholder', // Show placeholder lines instead of text
        showAvatars: true,
        showTimestamps: false,
        showActions: false,
        animationSpeed: 0.8
    },
    
    [ZOOM_LEVELS.NORMAL]: {
        name: 'Normal',
        zoomRange: [0.6, 1.5],
        showContent: 'full', // Show full text content
        showAvatars: true,
        showTimestamps: true,
        showActions: true,
        animationSpeed: 1.0
    },
    
    [ZOOM_LEVELS.DETAIL]: {
        name: 'Detail',
        zoomRange: [1.5, 3.0],
        showContent: 'enhanced', // Show full content with enhanced formatting
        showAvatars: true,
        showTimestamps: true,
        showActions: true,
        animationSpeed: 1.2
    }
};

class LoD {
    constructor() {
        // Current state
        this.contextLevel = CONTEXT_LEVELS.WORKSPACE;
        this.zoomLevel = ZOOM_LEVELS.NORMAL;
        this.currentZoom = 1.0;
        this.isLocked = false;
        
        // State history for navigation
        this.stateHistory = [];
        this.currentMessageId = null;
        this.currentConversationId = null;
        
        // Callbacks
        this.onStateChange = null;
        this.onTransition = null;
    }
    
    // Initialize with callbacks
    initialize(callbacks = {}) {
        this.onStateChange = callbacks.onStateChange || (() => {});
        this.onTransition = callbacks.onTransition || (() => {});
        
        // Initial state notification
        this.notifyStateChange();
    }
    
    // Update zoom and recalculate zoom-based LoD
    updateZoom(zoom) {
        this.currentZoom = zoom;
        const newZoomLevel = this.calculateZoomLevel(zoom);
        
        if (newZoomLevel !== this.zoomLevel) {
            this.zoomLevel = newZoomLevel;
            this.notifyStateChange();
        }
    }
    
    // Calculate zoom-based LoD level
    calculateZoomLevel(zoom) {
        for (const [level, config] of Object.entries(ZOOM_CONFIG)) {
            const [min, max] = config.zoomRange;
            if (zoom >= min && zoom < max) {
                return level;
            }
        }
        return ZOOM_LEVELS.DETAIL; // Default to highest detail
    }
    
    // Context transitions
    lockToConversation(conversationId, messageId) {
        if (this.contextLevel === CONTEXT_LEVELS.WORKSPACE) {
            this.pushState();
            this.contextLevel = CONTEXT_LEVELS.CONVERSATION;
            this.currentConversationId = conversationId;
            this.currentMessageId = messageId;
            this.isLocked = true;
            
            this.notifyTransition('lockToConversation', { conversationId, messageId });
            this.notifyStateChange();
        }
    }
    
    expandToMessage(messageId) {
        if (this.contextLevel === CONTEXT_LEVELS.CONVERSATION) {
            this.pushState();
            this.contextLevel = CONTEXT_LEVELS.MESSAGE;
            this.currentMessageId = messageId;
            
            this.notifyTransition('expandToMessage', { messageId });
            this.notifyStateChange();
        }
    }
    
    returnToConversation() {
        if (this.contextLevel === CONTEXT_LEVELS.MESSAGE) {
            const previousState = this.popState();
            if (previousState) {
                this.contextLevel = CONTEXT_LEVELS.CONVERSATION;
                this.notifyTransition('returnToConversation', { messageId: this.currentMessageId });
                this.notifyStateChange();
            }
        }
    }
    
    expandToMessage(messageId) {
        if (this.contextLevel !== CONTEXT_LEVELS.MESSAGE) {
            this.pushState(); // Save current state
            this.contextLevel = CONTEXT_LEVELS.MESSAGE;
            this.currentMessageId = messageId;
            this.isLocked = true;
            
            this.notifyTransition('expandToMessage', { messageId });
            this.notifyStateChange();
        }
    }

    returnToWorkspace() {
        if (this.contextLevel !== CONTEXT_LEVELS.WORKSPACE) {
            this.contextLevel = CONTEXT_LEVELS.WORKSPACE;
            this.currentConversationId = null;
            this.currentMessageId = null;
            this.isLocked = false;
            this.stateHistory = []; // Clear history
            
            this.notifyTransition('returnToWorkspace', {});
            this.notifyStateChange();
        }
    }
    
    // Force unlock - alias for returnToWorkspace
    unlock() {
        this.returnToWorkspace();
    }
    
    // State history management
    pushState() {
        this.stateHistory.push({
            contextLevel: this.contextLevel,
            zoomLevel: this.zoomLevel,
            currentZoom: this.currentZoom,
            currentConversationId: this.currentConversationId,
            currentMessageId: this.currentMessageId,
            isLocked: this.isLocked
        });
    }
    
    popState() {
        return this.stateHistory.pop();
    }
    
    // Get current configuration
    getContextConfig() {
        return CONTEXT_CONFIG[this.contextLevel];
    }
    
    getZoomConfig() {
        return ZOOM_CONFIG[this.zoomLevel];
    }
    
    // Get combined state
    getCurrentState() {
        return {
            context: {
                level: this.contextLevel,
                config: this.getContextConfig(),
                conversationId: this.currentConversationId,
                messageId: this.currentMessageId,
                isLocked: this.isLocked
            },
            zoom: {
                level: this.zoomLevel,
                config: this.getZoomConfig(),
                value: this.currentZoom
            },
            capabilities: this.getCapabilities(),
            styling: this.getStyling()
        };
    }
    
    // Get interaction capabilities for current state
    getCapabilities() {
        const contextConfig = this.getContextConfig();
        const zoomConfig = this.getZoomConfig();
        
        return {
            allowPanning: contextConfig.allowPanning,
            allowZooming: contextConfig.allowZooming,
            showControls: contextConfig.showControls,
            showInstructions: contextConfig.showInstructions,
            interactions: contextConfig.interactions,
            showContent: zoomConfig.showContent,
            showAvatars: zoomConfig.showAvatars,
            showTimestamps: zoomConfig.showTimestamps,
            showActions: zoomConfig.showActions && contextConfig.interactions.messageActions
        };
    }
    
    // Get styling parameters for current state
    getStyling() {
        const contextConfig = this.getContextConfig();
        const zoomConfig = this.getZoomConfig();
        
        return {
            transparency: contextConfig.hexTransparency,
            animationSpeed: zoomConfig.animationSpeed,
            layout: contextConfig.layout || 'grid'
        };
    }
    
    // Check if a specific interaction is allowed
    canPerformInteraction(interaction) {
        const capabilities = this.getCapabilities();
        return capabilities.interactions[interaction] || false;
    }
    
    // Get transparency values for hex types
    getHexTransparency(hexType, state = 'base') {
        const styling = this.getStyling();
        return styling.transparency[hexType]?.[state] || 0.2;
    }
    
    // Notification methods
    notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.getCurrentState());
        }
    }
    
    notifyTransition(transitionType, data) {
        if (this.onTransition) {
            this.onTransition(transitionType, data, this.getCurrentState());
        }
    }
    
    // Debug information
    getDebugInfo() {
        return {
            contextLevel: this.contextLevel,
            zoomLevel: this.zoomLevel,
            currentZoom: this.currentZoom,
            isLocked: this.isLocked,
            stateHistoryLength: this.stateHistory.length,
            currentState: this.getCurrentState()
        };
    }
}

// Create singleton instance
const lodManager = new LoD();

export default lodManager;
export { LoD, CONTEXT_CONFIG, ZOOM_CONFIG };