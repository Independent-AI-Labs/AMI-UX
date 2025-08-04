"use client";

import { useCallback } from 'react';

export const useMouseInteraction = ({
    conversationState,
    dragGhost,
    animationManager,
    unlockConversation,
    setIsDragging,
    setLastMouse,
    setStartMousePos,
    dragRef,
    lockedWebsiteId,
    handleUnlockWebsite
}) => {
    const handleMouseDown = useCallback((e) => {
        // Don't interfere with interactive elements or tiles
        if (e.target.tagName === 'INPUT' ||
            e.target.closest('.hex-input-container') ||
            e.target.closest('.hex-rich-input-editor') ||
            e.target.closest('.hex-editor-toolbar') ||
            e.target.closest('.hex-message-actions') ||
            e.target.closest('.hex-message') ||
            e.target.closest('.hex-website')) {
            return;
        }

        // Allow middle-click panning
        if (e.button === 1) { // Middle mouse button
            setIsDragging(true);
            setLastMouse({ x: e.clientX, y: e.clientY });
            setStartMousePos({ x: e.clientX, y: e.clientY });
            animationManager.current.setInitialVelocity(0, 0);
            dragRef.current = false;
            return;
        }

        // If anything is locked and clicking on empty space, unlock
        if (conversationState.isLocked || conversationState.isConversationMode || conversationState.isWebsiteMode) {
            unlockConversation();
            return;
        }

        // Only start panning on left-click if not dragging
        if (e.button === 0 && !dragGhost.visible) { // Left mouse button and no website drag
            setIsDragging(true);
            setLastMouse({ x: e.clientX, y: e.clientY });
            setStartMousePos({ x: e.clientX, y: e.clientY });
            animationManager.current.setInitialVelocity(0, 0);
            dragRef.current = false;
        }
    }, [conversationState.isLocked, conversationState.isConversationMode, conversationState.isWebsiteMode, unlockConversation, dragGhost.visible, setIsDragging, setLastMouse, setStartMousePos, animationManager, dragRef]);

    const handleCanvasClick = useCallback((e) => {
        // Don't handle click if it's on an interactive element
        if (e.target.tagName === 'INPUT' ||
            e.target.closest('.hex-input-container') ||
            e.target.closest('.hex-rich-input-editor') ||
            e.target.closest('.hex-editor-toolbar') ||
            e.target.closest('.hex-message-actions') ||
            e.target.closest('.hex-message')) {
            return;
        }
        
        // Unlock website if clicking outside of any website tile
        if (lockedWebsiteId && e.target === e.currentTarget) {
            handleUnlockWebsite();
        }
    }, [lockedWebsiteId, handleUnlockWebsite]);

    const handleCanvasWheel = useCallback((e) => {
        // Unlock website on scroll
        if (lockedWebsiteId) {
            handleUnlockWebsite();
        }
    }, [lockedWebsiteId, handleUnlockWebsite]);

    return {
        handleMouseDown,
        handleCanvasClick,
        handleCanvasWheel
    };
};