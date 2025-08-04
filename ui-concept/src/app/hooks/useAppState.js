/**
 * React Hook for Application State Management
 */

import { useState, useEffect, useCallback } from 'react';
import appState, { APP_STATES, StateActions } from '../appStateManager';

export function useAppState() {
    const [state, setState] = useState(appState.getState());

    // Subscribe to state changes
    useEffect(() => {
        const unsubscribe = appState.addListener(() => {
            setState(appState.getState());
        });

        return unsubscribe;
    }, []);

    // Action dispatcher
    const dispatch = useCallback((action) => {
        if (typeof action === 'function') {
            // Allow action creators
            action = action();
        }
        
        return appState.transitionTo(action.state, action.data);
    }, []);

    // Force dispatch for error recovery
    const forceDispatch = useCallback((action) => {
        if (typeof action === 'function') {
            action = action();
        }
        
        appState.forceTransitionTo(action.state, action.data);
    }, []);

    return {
        // Current state info
        currentState: state.current,
        previousState: state.previous,
        stateData: state.data,
        
        // State checks (based on reactive state, not instance methods)
        isWorkspaceFree: state.current === 'workspace_free',
        isConversationLocked: state.current === 'conversation_locked',
        isMessageFocused: state.current === 'message_focused',
        isDragging: state.current === 'workspace_dragging',
        isContextMenuOpen: state.current === 'context_menu_open',
        isInputActive: state.current === 'input_active',
        isInTransition: state.current.includes('_transitioning'),
        
        // Data getters (from reactive state data)
        conversationId: state.data.conversationId || null,
        messageId: state.data.messageId || null,
        errorMessage: state.data.errorMessage || null,
        
        // Actions
        dispatch,
        forceDispatch,
        
        // Direct state checks
        canTransitionTo: appState.canTransitionTo.bind(appState)
    };
}

// Convenience hooks for specific states
export function useWorkspaceState() {
    const { isWorkspaceFree, isDragging, dispatch } = useAppState();
    
    return {
        isFree: isWorkspaceFree,
        isDragging,
        enterWorkspace: () => dispatch(StateActions.enterWorkspace()),
        startDragging: (pos) => dispatch(StateActions.startDragging(pos)),
        stopDragging: () => dispatch(StateActions.stopDragging())
    };
}

export function useConversationState() {
    const { isConversationLocked, conversationId, dispatch } = useAppState();
    
    return {
        isLocked: isConversationLocked,
        conversationId,
        lock: (convId, msgId) => dispatch(StateActions.lockToConversation(convId, msgId)),
        unlock: () => dispatch(StateActions.unlockConversation()),
        startTransition: (convId, pos) => dispatch(StateActions.startConversationTransition(convId, pos))
    };
}

export function useMessageState() {
    const { isMessageFocused, messageId, dispatch } = useAppState();
    
    return {
        isFocused: isMessageFocused,
        messageId,
        focus: (msgId, convId) => dispatch(StateActions.focusMessage(msgId, convId)),
        startTransition: (msgId, pos) => dispatch(StateActions.startMessageTransition(msgId, pos))
    };
}

export function useContextMenuState() {
    const { isContextMenuOpen, stateData, dispatch } = useAppState();
    
    return {
        isOpen: isContextMenuOpen,
        position: stateData.position,
        options: stateData.options,
        open: (pos, opts) => dispatch(StateActions.openContextMenu(pos, opts)),
        close: () => dispatch(StateActions.closeContextMenu())
    };
}

export function useInputState() {
    const { isInputActive, conversationId, dispatch } = useAppState();
    
    return {
        isActive: isInputActive,
        conversationId,
        activate: (convId) => dispatch(StateActions.activateInput(convId)),
        showTyping: (convId) => dispatch(StateActions.showTypingIndicator(convId))
    };
}