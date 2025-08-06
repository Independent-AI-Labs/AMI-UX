"use client";

import React from 'react';
import BaseTile from './base/BaseTile';

/**
 * HexMessage component that extends BaseTile
 * Renders a hexagonal message tile with optimized viewport culling
 */
class HexMessage2 extends BaseTile {
    constructor(props) {
        super(props);
        
        // Add message-specific state
        this.state = {
            ...this.state,
            showActions: false,
            isLocking: false
        };
    }
    
    /**
     * Handle message-specific click
     */
    handleMessageClick = (e) => {
        if (!this.isInteractive()) return;
        
        e.stopPropagation();
        
        const { message, position, onLockToConversation } = this.props;
        
        if (onLockToConversation && !this.props.isLocked) {
            this.setState({ isLocking: true });
            onLockToConversation(position.q, position.r);
            
            // Reset locking state after animation
            setTimeout(() => {
                this.setState({ isLocking: false });
            }, 300);
        }
    };
    
    /**
     * Handle expand click
     */
    handleExpandClick = (e) => {
        if (!this.isInteractive()) return;
        
        e.stopPropagation();
        
        const { message, position, onExpandMessage } = this.props;
        if (onExpandMessage) {
            onExpandMessage(message.id, position.q, position.r);
        }
    };
    
    /**
     * Handle copy click
     */
    handleCopyClick = (e) => {
        if (!this.isInteractive()) return;
        
        e.stopPropagation();
        
        const { message, onCopyMessage } = this.props;
        if (onCopyMessage) {
            onCopyMessage(message.text);
        }
    };
    
    /**
     * Get message-specific styles
     */
    getMessageStyle() {
        const { message, zoom, lodState } = this.props;
        const { isHovered, isLocking } = this.state;
        
        const baseOpacity = message.sender === 'user' ? 0.95 : 0.90;
        const isSimplified = lodState && lodState.level > 0;
        
        return {
            opacity: isHovered ? 1 : baseOpacity,
            transform: `${isHovered ? 'scale(1.05)' : 'scale(1)'} ${isLocking ? 'scale(0.95)' : ''}`,
            filter: isSimplified ? 'none' : (isHovered ? 'brightness(1.1)' : 'brightness(1)'),
            transition: 'all 0.2s ease-out'
        };
    }
    
    /**
     * Render the message content
     */
    renderContent() {
        const { message, renderMarkdown, lodState } = this.props;
        const { showActions } = this.state;
        
        // Simplified rendering for distant view
        if (lodState && lodState.level > 1) {
            return (
                <div className="message-simplified">
                    <div className="message-dot" />
                </div>
            );
        }
        
        return (
            <>
                <div className="message-header">
                    <span className="message-sender">
                        {message.sender === 'user' ? 'You' : 'Assistant'}
                    </span>
                    <span className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                </div>
                
                <div className="message-content">
                    {renderMarkdown ? (
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }} />
                    ) : (
                        <p>{message.text}</p>
                    )}
                </div>
                
                {showActions && this.isInteractive() && (
                    <div className="message-actions">
                        <button onClick={this.handleExpandClick} className="action-button">
                            <span>Expand</span>
                        </button>
                        <button onClick={this.handleCopyClick} className="action-button">
                            <span>Copy</span>
                        </button>
                    </div>
                )}
            </>
        );
    }
    
    render() {
        const { message, hexSize } = this.props;
        const { isVisible } = this.state;
        
        if (!isVisible) {
            return null; // Don't render if not visible
        }
        
        const tileStyle = this.getBaseTileStyle();
        const messageStyle = this.getMessageStyle();
        
        return (
            <div
                ref={this.tileRef}
                className={`hex-message hex-${message.sender}`}
                style={tileStyle}
                onClick={this.handleMessageClick}
                onMouseEnter={(e) => {
                    this.handleMouseEnter(e);
                    this.setState({ showActions: true });
                }}
                onMouseLeave={(e) => {
                    this.handleMouseLeave(e);
                    this.setState({ showActions: false });
                }}
            >
                <div 
                    className="hex-content"
                    style={{
                        ...this.getContentWrapperStyle(),
                        ...messageStyle
                    }}
                >
                    {this.renderContent()}
                </div>
            </div>
        );
    }
}

export default HexMessage2;