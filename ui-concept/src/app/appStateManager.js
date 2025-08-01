/**
 * Application State Machine
 * 
 * Manages all application states and transitions cleanly
 */

// Define all possible application states
export const APP_STATES = {
    // Navigation states
    WORKSPACE_FREE: 'workspace_free',           // Free navigation, no conversation selected
    WORKSPACE_DRAGGING: 'workspace_dragging',   // User is dragging the viewport
    
    // Conversation states  
    CONVERSATION_LOCKED: 'conversation_locked', // Conversation is locked for input
    CONVERSATION_TRANSITIONING: 'conversation_transitioning', // Animating to conversation
    
    // Message states
    MESSAGE_FOCUSED: 'message_focused',         // Single message is focused/expanded
    MESSAGE_TRANSITIONING: 'message_transitioning', // Animating to message focus
    
    // UI interaction states
    CONTEXT_MENU_OPEN: 'context_menu_open',     // Right-click context menu is open
    INPUT_ACTIVE: 'input_active',               // User is typing in input field
    TYPING_INDICATOR: 'typing_indicator',       // Showing typing indicator
    
    // Loading/Error states
    LOADING: 'loading',                         // Loading data or processing
    ERROR: 'error'                              // Error state
};

// Define valid state transitions
const STATE_TRANSITIONS = {
    [APP_STATES.WORKSPACE_FREE]: [
        APP_STATES.WORKSPACE_DRAGGING,
        APP_STATES.CONVERSATION_LOCKED,
        APP_STATES.CONVERSATION_TRANSITIONING,
        APP_STATES.MESSAGE_TRANSITIONING,
        APP_STATES.CONTEXT_MENU_OPEN,
        APP_STATES.LOADING,
        APP_STATES.ERROR
    ],
    
    [APP_STATES.WORKSPACE_DRAGGING]: [
        APP_STATES.WORKSPACE_FREE,
        APP_STATES.CONTEXT_MENU_OPEN
    ],
    
    [APP_STATES.CONVERSATION_LOCKED]: [
        APP_STATES.WORKSPACE_FREE,
        APP_STATES.INPUT_ACTIVE,
        APP_STATES.TYPING_INDICATOR,
        APP_STATES.MESSAGE_TRANSITIONING,
        APP_STATES.CONVERSATION_TRANSITIONING, // Switch to different conversation
        APP_STATES.CONTEXT_MENU_OPEN,
        APP_STATES.ERROR
    ],
    
    [APP_STATES.CONVERSATION_TRANSITIONING]: [
        APP_STATES.CONVERSATION_LOCKED,
        APP_STATES.WORKSPACE_FREE,
        APP_STATES.ERROR
    ],
    
    [APP_STATES.MESSAGE_FOCUSED]: [
        APP_STATES.CONVERSATION_LOCKED,
        APP_STATES.WORKSPACE_FREE,
        APP_STATES.ERROR
    ],
    
    [APP_STATES.MESSAGE_TRANSITIONING]: [
        APP_STATES.MESSAGE_FOCUSED,
        APP_STATES.WORKSPACE_FREE,
        APP_STATES.ERROR
    ],
    
    [APP_STATES.CONTEXT_MENU_OPEN]: [
        APP_STATES.WORKSPACE_FREE,
        APP_STATES.CONVERSATION_TRANSITIONING,
        APP_STATES.LOADING
    ],
    
    [APP_STATES.INPUT_ACTIVE]: [
        APP_STATES.CONVERSATION_LOCKED,
        APP_STATES.TYPING_INDICATOR,
        APP_STATES.WORKSPACE_FREE
    ],
    
    [APP_STATES.TYPING_INDICATOR]: [
        APP_STATES.CONVERSATION_LOCKED,
        APP_STATES.WORKSPACE_FREE
    ],
    
    [APP_STATES.LOADING]: [
        APP_STATES.WORKSPACE_FREE,
        APP_STATES.CONVERSATION_LOCKED,
        APP_STATES.ERROR
    ],
    
    [APP_STATES.ERROR]: [
        APP_STATES.WORKSPACE_FREE
    ]
};

// State data structure
class AppState {
    constructor() {
        this.currentState = APP_STATES.WORKSPACE_FREE;
        this.previousState = null;
        this.stateData = {};
        this.listeners = new Set();
    }

    // Get current state
    getState() {
        return {
            current: this.currentState,
            previous: this.previousState,
            data: { ...this.stateData }
        };
    }

    // Check if transition is valid
    canTransitionTo(newState) {
        const allowedTransitions = STATE_TRANSITIONS[this.currentState] || [];
        return allowedTransitions.includes(newState);
    }

    // Perform state transition
    transitionTo(newState, data = {}) {
        if (!this.canTransitionTo(newState)) {
            console.error(`Invalid transition from ${this.currentState} to ${newState}`);
            return false;
        }

        const oldState = this.currentState;
        const oldData = { ...this.stateData };

        // Perform transition
        this.previousState = this.currentState;
        this.currentState = newState;
        this.stateData = { ...data };

        // Notify listeners
        this.notifyListeners({
            from: oldState,
            to: newState,
            oldData,
            newData: { ...this.stateData }
        });
        return true;
    }

    // Force transition (for error recovery)
    forceTransitionTo(newState, data = {}) {
        console.warn(`Forcing transition from ${this.currentState} to ${newState}`);
        this.previousState = this.currentState;
        this.currentState = newState;
        this.stateData = { ...data };
        
        this.notifyListeners({
            from: this.previousState,
            to: newState,
            oldData: {},
            newData: { ...this.stateData },
            forced: true
        });
    }

    // Add state change listener
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // Notify all listeners
    notifyListeners(transitionData) {
        this.listeners.forEach(callback => {
            try {
                callback(transitionData);
            } catch (error) {
                console.error('State listener error:', error);
            }
        });
    }

    // Helper methods for common state checks
    isWorkspaceFree() {
        return this.currentState === APP_STATES.WORKSPACE_FREE;
    }

    isConversationLocked() {
        return this.currentState === APP_STATES.CONVERSATION_LOCKED;
    }

    isMessageFocused() {
        return this.currentState === APP_STATES.MESSAGE_FOCUSED;
    }

    isDragging() {
        return this.currentState === APP_STATES.WORKSPACE_DRAGGING;
    }

    isContextMenuOpen() {
        return this.currentState === APP_STATES.CONTEXT_MENU_OPEN;
    }

    isInputActive() {
        return this.currentState === APP_STATES.INPUT_ACTIVE;
    }

    isInTransition() {
        return this.currentState.includes('_transitioning');
    }

    // Get state-specific data
    getConversationId() {
        return this.stateData.conversationId || null;
    }

    getMessageId() {
        return this.stateData.messageId || null;
    }

    getErrorMessage() {
        return this.stateData.errorMessage || null;
    }
}

// Action creators for common state transitions
export const StateActions = {
    // Workspace actions
    enterWorkspace: () => ({ 
        state: APP_STATES.WORKSPACE_FREE, 
        data: {} 
    }),

    startDragging: (startPos) => ({ 
        state: APP_STATES.WORKSPACE_DRAGGING, 
        data: { startPos } 
    }),

    stopDragging: () => ({ 
        state: APP_STATES.WORKSPACE_FREE, 
        data: {} 
    }),

    // Conversation actions
    lockToConversation: (conversationId, messageId = null) => ({ 
        state: APP_STATES.CONVERSATION_LOCKED, 
        data: { conversationId, messageId } 
    }),

    startConversationTransition: (conversationId, targetPosition) => ({ 
        state: APP_STATES.CONVERSATION_TRANSITIONING, 
        data: { conversationId, targetPosition } 
    }),

    unlockConversation: () => ({ 
        state: APP_STATES.WORKSPACE_FREE, 
        data: {} 
    }),

    // Message actions
    focusMessage: (messageId, conversationId) => ({ 
        state: APP_STATES.MESSAGE_FOCUSED, 
        data: { messageId, conversationId } 
    }),

    startMessageTransition: (messageId, targetPosition) => ({ 
        state: APP_STATES.MESSAGE_TRANSITIONING, 
        data: { messageId, targetPosition } 
    }),

    // UI actions
    openContextMenu: (position, options) => ({ 
        state: APP_STATES.CONTEXT_MENU_OPEN, 
        data: { position, options } 
    }),

    closeContextMenu: () => ({ 
        state: APP_STATES.WORKSPACE_FREE, 
        data: {} 
    }),

    activateInput: (conversationId) => ({ 
        state: APP_STATES.INPUT_ACTIVE, 
        data: { conversationId } 
    }),

    showTypingIndicator: (conversationId) => ({ 
        state: APP_STATES.TYPING_INDICATOR, 
        data: { conversationId } 
    }),

    // Error handling
    showError: (errorMessage) => ({ 
        state: APP_STATES.ERROR, 
        data: { errorMessage } 
    }),

    startLoading: (loadingMessage = 'Loading...') => ({ 
        state: APP_STATES.LOADING, 
        data: { loadingMessage } 
    })
};

// Create singleton instance
const appState = new AppState();
export default appState;