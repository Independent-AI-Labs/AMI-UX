/**
 * Unified Lock State Management Hook
 * Manages locking/unlocking for both conversations and websites
 */

import { useState, useCallback, useRef } from 'react';

export const LOCK_TYPES = {
    NONE: 'none',
    CONVERSATION: 'conversation',
    WEBSITE: 'website'
};

export function useLockState(animationManager, lodManager, screenCenter, hexToPixel) {
    const [lockState, setLockState] = useState({
        type: LOCK_TYPES.NONE,
        id: null,
        position: null
    });
    
    // Use a ref to track if we're currently processing a lock operation
    const isProcessingLock = useRef(false);

    const unlock = useCallback(() => {
        console.log('Unlock called');
        
        // Clear all systems regardless of current state
        try {
            lodManager.unlock();
            lodManager.returnToWorkspace();
        } catch (e) {
            console.error('Error unlocking lodManager:', e);
        }
        
        try {
            if (animationManager.current) {
                animationManager.current.setLocked(false);
            }
        } catch (e) {
            console.error('Error unlocking animationManager:', e);
        }
        
        // Always reset state to NONE
        setLockState({
            type: LOCK_TYPES.NONE,
            id: null,
            position: null
        });
        
        // Clear the processing flag
        isProcessingLock.current = false;
    }, [lodManager, animationManager]);

    const lockToConversation = useCallback((conversationId, messageId, q, r) => {
        console.log(`lockToConversation called: ${conversationId} at (${q}, ${r})`);
        
        // Prevent concurrent lock operations
        if (isProcessingLock.current) {
            console.log('Already processing a lock, skipping');
            return;
        }
        
        isProcessingLock.current = true;
        
        // Always unlock first to ensure clean state
        try {
            lodManager.unlock();
            lodManager.returnToWorkspace();
            if (animationManager.current) {
                animationManager.current.setLocked(false);
            }
        } catch (e) {
            console.error('Error during unlock before conversation lock:', e);
        }

        // Now perform the lock
        try {
            // Transition to conversation level
            lodManager.lockToConversation(conversationId, messageId);
            
            const zoom = 1.8;
            
            // Find the conversation column (even number) that this message belongs to
            const conversationQ = Math.floor(q / 2) * 2;
            
            // Center the conversation horizontally, keep clicked row vertically centered
            const conversationCenterX = hexToPixel(conversationQ + 0.5, 0).x;
            const clickedCenterY = hexToPixel(0, r).y;
            
            const newX = screenCenter.x - (conversationCenterX * zoom);
            const newY = screenCenter.y - (clickedCenterY * zoom);

            animationManager.current.setViewState({
                x: newX,
                y: newY,
                zoom: zoom
            });
            animationManager.current.setLocked(true);
            
            // Update state
            setLockState({
                type: LOCK_TYPES.CONVERSATION,
                id: conversationId,
                position: { q, r, messageId }
            });
            
            console.log('Successfully locked to conversation');
        } catch (e) {
            console.error('Error locking to conversation:', e);
            isProcessingLock.current = false;
        }
        
        // Clear processing flag after a short delay to ensure state updates complete
        setTimeout(() => {
            isProcessingLock.current = false;
        }, 100);
    }, [lodManager, animationManager, screenCenter, hexToPixel]);

    const lockToWebsite = useCallback((websiteId, q, r) => {
        console.log(`lockToWebsite called: ${websiteId} at (${q}, ${r})`);
        
        // Prevent concurrent lock operations
        if (isProcessingLock.current) {
            console.log('Already processing a lock, skipping');
            return;
        }
        
        isProcessingLock.current = true;
        
        // Always unlock first to ensure clean state
        try {
            lodManager.unlock();
            lodManager.returnToWorkspace();
            if (animationManager.current) {
                animationManager.current.setLocked(false);
            }
        } catch (e) {
            console.error('Error during unlock before website lock:', e);
        }

        // Now perform the lock
        try {
            // Get the pixel position of the website tile
            const tileCenter = hexToPixel(q, r);
            const zoom = 1.8;
            
            // Calculate view position to center this tile
            const newX = screenCenter.x - (tileCenter.x * zoom);
            const newY = screenCenter.y - (tileCenter.y * zoom);
            
            animationManager.current.setViewState({
                x: newX,
                y: newY,
                zoom: zoom
            });
            animationManager.current.setLocked(true);
            
            // Update state
            setLockState({
                type: LOCK_TYPES.WEBSITE,
                id: websiteId,
                position: { q, r }
            });
            
            console.log('Successfully locked to website');
        } catch (e) {
            console.error('Error locking to website:', e);
            isProcessingLock.current = false;
        }
        
        // Clear processing flag after a short delay to ensure state updates complete
        setTimeout(() => {
            isProcessingLock.current = false;
        }, 100);
    }, [animationManager, screenCenter, hexToPixel, lodManager]);

    return {
        lockState,
        isLocked: lockState.type !== LOCK_TYPES.NONE,
        isConversationLocked: lockState.type === LOCK_TYPES.CONVERSATION,
        isWebsiteLocked: lockState.type === LOCK_TYPES.WEBSITE,
        lockedId: lockState.id,
        lockedPosition: lockState.position,
        
        // Actions
        unlock,
        lockToConversation,
        lockToWebsite
    };
}