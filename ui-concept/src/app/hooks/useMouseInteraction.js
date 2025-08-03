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
        if (e.target.tagName === 'INPUT' ||
            e.target.closest('.hex-input-container') ||
            e.target.closest('.hex-rich-input-editor') ||
            e.target.closest('.hex-editor-toolbar') ||
            e.target.closest('.hex-message-actions') ||
            (conversationState.isLocked && e.target.closest('.selectable-text')) ||
            (conversationState.isLocked && e.target.closest('.hex-message'))) {
            return;
        }

        // Allow middle-click panning even when website is being dragged
        if (e.button === 1) { // Middle mouse button
            setIsDragging(true);
            setLastMouse({ x: e.clientX, y: e.clientY });
            setStartMousePos({ x: e.clientX, y: e.clientY });
            animationManager.current.setInitialVelocity(0, 0);
            dragRef.current = false;
            return;
        }

        // If locked and clicking outside the conversation, unlock (act as ESC)
        if (conversationState.isLocked) {
            unlockConversation();
            return;
        }

        // Only start panning on left-click if not dragging a website
        if (e.button === 0 && !dragGhost.visible) { // Left mouse button and no website drag
            setIsDragging(true);
            setLastMouse({ x: e.clientX, y: e.clientY });
            setStartMousePos({ x: e.clientX, y: e.clientY });
            animationManager.current.setInitialVelocity(0, 0);
            dragRef.current = false;
        }
    }, [conversationState.isLocked, unlockConversation, dragGhost.visible, setIsDragging, setLastMouse, setStartMousePos, animationManager, dragRef]);

    const handleCanvasClick = useCallback((e) => {
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