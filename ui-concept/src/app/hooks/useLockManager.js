/**
 * React Hook for Lock Manager
 * Provides reactive state and actions for the lock manager
 */

import { useState, useEffect, useCallback } from 'react';
import lockManager from '../LockManager';

export function useLockManager(animationManager, lodManager, screenCenter, hexToPixel) {
    const [lockState, setLockState] = useState(lockManager.getState());
    
    // Initialize lock manager with dependencies
    useEffect(() => {
        lockManager.initialize(animationManager, lodManager, hexToPixel, screenCenter);
    }, [animationManager, lodManager, hexToPixel, screenCenter]);
    
    // Subscribe to state changes
    useEffect(() => {
        const unsubscribe = lockManager.subscribe((oldState, newState) => {
            console.log('[useLockManager] State changed:', oldState, '->', newState);
            setLockState(newState);
        });
        
        return unsubscribe;
    }, []);
    
    // Action methods
    const lockToConversation = useCallback((conversationId, messageId, q, r) => {
        lockManager.requestConversationLock(conversationId, messageId, q, r);
    }, []);
    
    const lockToWebsite = useCallback((websiteId, q, r) => {
        lockManager.requestWebsiteLock(websiteId, q, r);
    }, []);
    
    const unlock = useCallback(() => {
        lockManager.requestUnlock();
    }, []);
    
    // Helper methods
    const isWebsiteLocked = useCallback((websiteId) => {
        return lockManager.isTargetLocked('website', websiteId);
    }, []);
    
    const isConversationLocked = useCallback((conversationId) => {
        return lockManager.isTargetLocked('conversation', conversationId);
    }, []);
    
    return {
        // State
        lockState,
        isLocked: lockState.mode !== 'free',
        isConversationMode: lockState.mode === 'conversation',
        isWebsiteMode: lockState.mode === 'website',
        lockedTarget: lockState.target,
        lockMetadata: lockState.metadata,
        
        // Actions
        lockToConversation,
        lockToWebsite,
        unlock,
        
        // Helpers
        isWebsiteLocked,
        isConversationLocked
    };
}