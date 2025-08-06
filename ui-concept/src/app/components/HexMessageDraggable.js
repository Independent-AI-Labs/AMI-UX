"use client";

import React from 'react';
import BaseDraggableTile from './base/BaseDraggableTile';
import HexMessageTransition from './HexMessageTransition';

/**
 * HexMessage component that extends BaseDraggableTile
 * Provides message-specific rendering and behavior
 */
class HexMessageDraggable extends BaseDraggableTile {
    /**
     * Messages are not draggable
     */
    isDraggable() {
        return false;
    }
    
    /**
     * Get hex type for LoD
     */
    getHexType() {
        return 'message';
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
     * Get tile-specific CSS classes
     */
    getTileClassName() {
        const { message } = this.props;
        return message.sender === 'user' ? 'hex-user' : '';
    }
    
    /**
     * Handle click - lock to conversation
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
     * Render content using HexMessageTransition
     */
    renderContent() {
        const { message, isLocked, renderMarkdown, onCopyMessage, onCloseExpanded, lodState } = this.props;
        
        return (
            <HexMessageTransition
                message={message}
                useLoD={false}
                isLocked={isLocked}
                renderMarkdown={renderMarkdown}
                onCopyMessage={onCopyMessage}
                onCloseExpanded={onCloseExpanded}
                lodState={lodState}
            />
        );
    }
    
    /**
     * Render LoD placeholder
     */
    renderLoDPlaceholder() {
        const { message, isLocked, renderMarkdown, onCopyMessage, onCloseExpanded, lodState } = this.props;
        
        return (
            <HexMessageTransition
                message={message}
                useLoD={true}
                isLocked={isLocked}
                renderMarkdown={renderMarkdown}
                onCopyMessage={onCopyMessage}
                onCloseExpanded={onCloseExpanded}
                lodState={lodState}
            />
        );
    }
}

export default HexMessageDraggable;