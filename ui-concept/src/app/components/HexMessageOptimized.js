"use client";

import React from 'react';
import BaseHexTile from './base/BaseHexTile';
import HexMessageTransition from './HexMessageTransition';

/**
 * Optimized HexMessage component that extends BaseHexTile
 * Inherits viewport culling and base functionality
 * Provides message-specific CSS and rendering
 */
class HexMessageOptimized extends BaseHexTile {
    /**
     * Provide message-specific CSS classes
     */
    getClassName() {
        const { message } = this.props;
        return `animate-fade-in hex-with-backdrop ${message.sender === 'user' ? 'hex-user' : ''}`;
    }
    
    /**
     * Get hex type for LoD wrapper
     */
    getHexType() {
        return 'message';
    }
    
    /**
     * Handle message click - lock to conversation
     */
    handleTileClick(e) {
        const { isLocked, onLockToConversation, position } = this.props;
        if (!isLocked && onLockToConversation) {
            onLockToConversation(position.q, position.r);
        }
    }
    
    /**
     * Handle double click - expand message
     */
    handleTileDoubleClick(e) {
        const { isLocked, onExpandMessage, message, position } = this.props;
        if (isLocked && onExpandMessage) {
            onExpandMessage(message.id, position.q, position.r);
        }
    }
    
    /**
     * Get backdrop color based on sender
     */
    getBackdropColor() {
        const { message } = this.props;
        return message.sender === 'user' 
            ? 'rgba(144, 192, 255, 0.4)' 
            : 'rgba(255, 255, 255, 0.4)';
    }
    
    /**
     * Render message content using HexMessageTransition
     */
    renderContent() {
        const { 
            message, 
            isLocked, 
            renderMarkdown, 
            onCopyMessage, 
            onCloseExpanded,
            lodState 
        } = this.props;
        
        // Use LoD system to determine detail level
        const useLoD = lodState?.zoom.config.showContent === 'placeholder';
        
        return (
            <HexMessageTransition
                message={message}
                useLoD={useLoD}
                isLocked={isLocked}
                renderMarkdown={renderMarkdown}
                onCopyMessage={onCopyMessage}
                onCloseExpanded={onCloseExpanded}
                lodState={lodState}
            />
        );
    }
}

export default HexMessageOptimized;