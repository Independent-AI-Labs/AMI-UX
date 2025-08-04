"use client";

import { useCallback, useMemo, useRef } from 'react';
import { DataTile, UITile } from '../tileSystem';
import tileGrid from '../tileSystem';
import tileManager from '../tileManager';
import lodManager, { CONTEXT_LEVELS } from '../lodManager';

export const useConversationLogic = ({
    messages,
    websites,
    conversationState,
    screenCenter,
    hexToPixel,
    pixelToHex,
    viewState,
    containerRef,
    animationManager,
    setMessages,
    setErrorToast
}) => {
    // Simple helper: Get message position (all messages already have coordinates)
    const getMessagePosition = (message) => {
        return { q: message.q, r: message.r };
    };

    // Simple helper: Check if columns are available for new conversation
    const areColumnsAvailable = useCallback((q) => {
        return tileGrid.isColumnPairAvailable(q);
    }, []);

    // Find available column pair near mouse position
    const getAvailableColumnsNearMouse = useCallback((mouseX, mouseY) => {
        const usedPositions = new Set();
        messages.forEach((message, index) => {
            const pos = getMessagePosition(message, index);
            if (pos) {
                usedPositions.add(`${pos.q},${pos.r}`);
            }
        });

        // Convert screen coordinates to container-relative coordinates
        const rect = containerRef.current?.getBoundingClientRect();
        let containerX = mouseX;
        let containerY = mouseY;
        
        if (rect) {
            containerX = mouseX - rect.left;
            containerY = mouseY - rect.top;
        }
        
        // Convert container position to world coordinates
        const worldX = (containerX - viewState.x) / viewState.zoom;
        const worldY = (containerY - viewState.y) / viewState.zoom;
        
        // Convert to hex coordinates
        const mouseHex = pixelToHex(worldX, worldY);
        
        // Find the nearest even column (conversations start on even columns)
        const nearestEvenQ = Math.round(mouseHex.q / 2) * 2;
        
        // Check columns starting from the nearest even column, then expanding outward
        const columnsToCheck = [nearestEvenQ];
        for (let offset = 2; offset <= 20; offset += 2) {
            columnsToCheck.push(nearestEvenQ + offset);
            if (nearestEvenQ - offset >= 0) {
                columnsToCheck.push(nearestEvenQ - offset);
            }
        }

        for (const startQ of columnsToCheck) {
            if (startQ < 0) continue;
            
            let hasSpace = true;
            // Check if this column pair has enough space (at least 12 rows)
            for (let row = 0; row < 12; row++) {
                const leftPos = `${startQ},${row}`;
                const rightPos = `${startQ + 1},${row}`;
                if (usedPositions.has(leftPos) || usedPositions.has(rightPos)) {
                    hasSpace = false;
                    break;
                }
            }
            if (hasSpace) {
                return startQ;
            }
        }
        return null;
    }, [messages, viewState, pixelToHex, containerRef]);

    const canStartNewChat = useMemo(() => {
        // Use a default position for checking availability
        return getAvailableColumnsNearMouse(screenCenter.x, screenCenter.y) !== null;
    }, [getAvailableColumnsNearMouse, screenCenter]);

    const startNewChat = useCallback(() => {
        // Get the right-clicked tile from tile manager
        const rightClickedTile = tileManager.getRightClickedTile();
        
        if (!rightClickedTile) {
            console.warn('No right-clicked tile found');
            return;
        }
        
        const clickedQ = rightClickedTile.q;
        const clickedR = rightClickedTile.r;
        
        // Check if columns are available
        if (!areColumnsAvailable(clickedQ)) {
            setErrorToast({
                visible: true,
                message: `Territory occupied. Cannot establish conversation at (${clickedQ}, ${clickedR}).`
            });
            return;
        }
        
        // Create new conversation ID
        const conversationId = `conv_${Date.now()}`;
        const conversationStartQ = Math.floor(clickedQ / 2) * 2;
        
        // Create new message with coordinates
        const newMessage = {
            id: Date.now(),
            conversationId: conversationId,
            text: "**Welcome to a new conversation!** \\n\\n*Ready to explore new ideas together.*\\n\\nWhat would you like to discuss today?",
            sender: "ai",
            timestamp: new Date(),
            q: conversationStartQ,  // Always start at left column
            r: clickedR
        };

        // Create functional data tile
        const dataTile = new DataTile(
            newMessage.id,
            'message',
            newMessage,
            { q: conversationStartQ, r: clickedR }
        );
        tileGrid.addDataTile(dataTile);

        // Add message to state (this will trigger tile grid refresh)
        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // Lock to the new conversation using state manager
        conversationState.lock(conversationId, newMessage.id);
    }, [areColumnsAvailable, conversationState, setMessages, setErrorToast]);

    const lockToConversation = useCallback((q, r, messageId) => {
        // Check current LoD context level
        const currentState = lodManager.getCurrentState();
        
        if (currentState.context.level === CONTEXT_LEVELS.WORKSPACE) {
            // Find the message to get its conversationId
            const message = messages.find(m => m.id === messageId);
            const conversationId = message ? message.conversationId : `conv_${Math.floor(q / 2)}`;
            
            // Transition to conversation level
            lodManager.lockToConversation(conversationId, messageId);
            
            const zoom = 1.8;
            const clickedHexCenter = hexToPixel(q, r);
            
            // Find the conversation column (even number) that this message belongs to
            const conversationQ = Math.floor(q / 2) * 2;
            
            // Lock conversation using state manager
            conversationState.lock(conversationId, messageId);
            
            // Center the conversation horizontally, keep clicked row vertically centered
            const conversationCenterX = hexToPixel(conversationQ + 0.5, 0).x; // Center between the two columns
            const clickedCenterY = hexToPixel(0, r).y; // Keep the clicked row's Y position
            
            const newX = screenCenter.x - (conversationCenterX * zoom);
            const newY = screenCenter.y - (clickedCenterY * zoom);

            animationManager.current.setViewState({
                x: newX,
                y: newY,
                zoom: zoom
            });
            animationManager.current.setLocked(true);
            
        } else if (currentState.context.level === CONTEXT_LEVELS.CONVERSATION) {
            // Transition to message level - expand message to full viewport
            lodManager.expandToMessage(messageId);
            
            // Implement full viewport expansion animation
            const targetZoom = 2.5; // Larger zoom for message focus
            const messageCenter = hexToPixel(q, r); // Calculate center for this message
            const newX = screenCenter.x - (messageCenter.x * targetZoom);
            const newY = screenCenter.y - (messageCenter.y * targetZoom);
            
            animationManager.current.setViewState({
                x: newX,
                y: newY,
                zoom: targetZoom
            });
            
            console.log(`Expanding message ${messageId} to full viewport`);
        }
    }, [messages, screenCenter, hexToPixel, conversationState, animationManager]);

    return {
        areColumnsAvailable,
        getAvailableColumnsNearMouse,
        canStartNewChat,
        startNewChat,
        lockToConversation,
        getMessagePosition
    };
};