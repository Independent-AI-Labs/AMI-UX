"use client";

import React from 'react';
import BaseTile from './base/BaseTile';
import { Globe, X, Maximize2, GripVertical } from 'lucide-react';

/**
 * HexWebsite component that extends BaseTile
 * Renders a website tile with optimized viewport culling
 */
class HexWebsite2 extends BaseTile {
    constructor(props) {
        super(props);
        
        // Add website-specific state
        this.state = {
            ...this.state,
            showControls: false,
            isDragging: false,
            isLoading: true,
            faviconUrl: null
        };
        
        this.iframeRef = React.createRef();
    }
    
    componentDidMount() {
        super.componentDidMount();
        this.loadFavicon();
    }
    
    /**
     * Load website favicon
     */
    loadFavicon = async () => {
        const { website } = this.props;
        try {
            const url = new URL(website.url);
            const faviconUrl = `${url.protocol}//${url.hostname}/favicon.ico`;
            this.setState({ faviconUrl });
        } catch (e) {
            console.error('Failed to load favicon:', e);
        }
    };
    
    /**
     * Handle website click
     */
    handleWebsiteClick = (e) => {
        if (!this.isInteractive()) return;
        
        e.stopPropagation();
        
        const { website, position, onLockToWebsite } = this.props;
        if (onLockToWebsite && !this.props.lockedWebsiteId) {
            onLockToWebsite(website.id, position.q, position.r);
        }
    };
    
    /**
     * Handle remove click
     */
    handleRemoveClick = (e) => {
        if (!this.isInteractive()) return;
        
        e.stopPropagation();
        
        const { website, onRemoveWebsite } = this.props;
        if (onRemoveWebsite) {
            onRemoveWebsite(website.id);
        }
    };
    
    /**
     * Handle expand click
     */
    handleExpandClick = (e) => {
        if (!this.isInteractive()) return;
        
        e.stopPropagation();
        
        const { website, position, onExpandWebsite } = this.props;
        if (onExpandWebsite) {
            onExpandWebsite(website.id, position.q, position.r);
        }
    };
    
    /**
     * Handle drag start
     */
    handleDragStart = (e) => {
        if (!this.isInteractive()) return;
        
        e.stopPropagation();
        this.setState({ isDragging: true });
        
        const { website, position, setDragGhost } = this.props;
        if (setDragGhost) {
            setDragGhost({
                visible: true,
                website: website,
                startQ: position.q,
                startR: position.r
            });
        }
    };
    
    /**
     * Get website-specific styles
     */
    getWebsiteStyle() {
        const { website, lockedWebsiteId, lodState } = this.props;
        const { isHovered, showControls } = this.state;
        
        const isLocked = lockedWebsiteId === website.id;
        const isSimplified = lodState && lodState.level > 0;
        
        return {
            opacity: isHovered || isLocked ? 1 : 0.9,
            transform: `${isHovered ? 'scale(1.05)' : 'scale(1)'} ${isLocked ? 'scale(1.1)' : ''}`,
            filter: isSimplified ? 'none' : (isHovered ? 'brightness(1.1)' : 'brightness(1)'),
            boxShadow: isLocked ? '0 0 48px rgba(255, 255, 255, 0.8)' : '0 4px 24px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s ease-out'
        };
    }
    
    /**
     * Render website content
     */
    renderContent() {
        const { website, lodState } = this.props;
        const { showControls, faviconUrl, isLoading } = this.state;
        
        // Simplified rendering for distant view
        if (lodState && lodState.level > 1) {
            return (
                <div className="website-simplified">
                    <Globe size={24} />
                </div>
            );
        }
        
        return (
            <>
                {/* Website Header */}
                <div className="website-header">
                    {faviconUrl && (
                        <img 
                            src={faviconUrl} 
                            alt="favicon" 
                            className="website-favicon"
                            width={16}
                            height={16}
                        />
                    )}
                    <span className="website-domain">
                        {new URL(website.url).hostname}
                    </span>
                </div>
                
                {/* Controls */}
                {showControls && this.isInteractive() && (
                    <div className="website-controls">
                        <button 
                            className="control-button drag-handle"
                            onMouseDown={this.handleDragStart}
                            title="Move"
                        >
                            <GripVertical size={16} />
                        </button>
                        <button 
                            className="control-button"
                            onClick={this.handleExpandClick}
                            title="Expand"
                        >
                            <Maximize2 size={16} />
                        </button>
                        <button 
                            className="control-button remove"
                            onClick={this.handleRemoveClick}
                            title="Remove"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
                
                {/* Website Preview */}
                <div className="website-preview">
                    {isLoading && (
                        <div className="website-loading">
                            <div className="loading-spinner" />
                        </div>
                    )}
                    <iframe
                        ref={this.iframeRef}
                        src={website.url}
                        className="website-iframe"
                        sandbox="allow-scripts allow-same-origin"
                        onLoad={() => this.setState({ isLoading: false })}
                        style={{
                            opacity: isLoading ? 0 : 1,
                            pointerEvents: showControls ? 'none' : 'auto'
                        }}
                    />
                </div>
            </>
        );
    }
    
    render() {
        const { website } = this.props;
        const { isVisible } = this.state;
        
        if (!isVisible) {
            return null; // Don't render if not visible
        }
        
        const tileStyle = this.getBaseTileStyle();
        const websiteStyle = this.getWebsiteStyle();
        
        return (
            <div
                ref={this.tileRef}
                className="hex-website"
                style={tileStyle}
                onClick={this.handleWebsiteClick}
                onMouseEnter={(e) => {
                    this.handleMouseEnter(e);
                    this.setState({ showControls: true });
                }}
                onMouseLeave={(e) => {
                    this.handleMouseLeave(e);
                    this.setState({ showControls: false });
                }}
            >
                <div 
                    className="hex-content website-content"
                    style={{
                        ...this.getContentWrapperStyle(),
                        ...websiteStyle
                    }}
                >
                    {this.renderContent()}
                </div>
            </div>
        );
    }
}

export default HexWebsite2;