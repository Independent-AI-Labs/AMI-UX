"use client";

import React from 'react';
import BaseDraggableTile from './base/BaseDraggableTile';
import CompactModal from './CompactModal';
import { ExternalLink, X, ArrowUpRight, Move, Edit2, Trash2 } from 'lucide-react';

/**
 * HexWebsite component that extends BaseDraggableTile
 * Provides website-specific rendering and drag behavior
 */
class HexWebsiteDraggable extends BaseDraggableTile {
    constructor(props) {
        super(props);
        
        // Add website-specific state
        this.state = {
            ...this.state,
            isLoading: true,
            hasError: false,
            errorType: 'generic',
            showDeleteConfirm: false,
            showEditUrl: false,
            editingUrl: props.website.url
        };
        
        this.iframeRef = React.createRef();
        this.hexRef = React.createRef();
        this.hoverTimeoutRef = null;
        this.animationFrame = null;
        this.currentPos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
    }
    
    componentWillUnmount() {
        super.componentWillUnmount();
        if (this.hoverTimeoutRef) {
            clearTimeout(this.hoverTimeoutRef);
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
    
    /**
     * Websites are draggable
     */
    isDraggable() {
        return true;
    }
    
    /**
     * Websites use external drag handle (floating Move button)
     */
    useExternalDragHandle() {
        return true;
    }
    
    /**
     * Websites use screen blend mode
     */
    useScreenBlendMode() {
        return true;
    }
    
    /**
     * Get hex type for LoD
     */
    getHexType() {
        return 'website';
    }
    
    /**
     * Get backdrop color
     */
    getBackdropColor() {
        return 'rgba(255, 255, 255, 0.9)';
    }
    
    /**
     * Get tile-specific CSS classes
     */
    getTileClassName() {
        const { isWebsiteLocked } = this.props;
        // Note: We don't add hex-website here as it goes on the content div
        return isWebsiteLocked ? 'hex-locked' : '';
    }
    
    /**
     * Override hover start for parallax and handle
     */
    onTileHoverStart() {
        // Clear any pending hide timeout
        if (this.hoverTimeoutRef) {
            clearTimeout(this.hoverTimeoutRef);
            this.hoverTimeoutRef = null;
        }
        
        // Notify parent about hover with drag handle
        const { onHoverChange, website, position, hexSize } = this.props;
        if (onHoverChange) {
            // Create a properly bound drag start handler for the external handle
            const exposedHandleDragStart = (e) => this.handleDragStart(e);
            onHoverChange(website.id, true, { 
                x: position.x, 
                y: position.y, 
                hexSize, 
                onDragStart: exposedHandleDragStart 
            });
        }
    }
    
    /**
     * Override hover end with delay
     */
    onTileHoverEnd() {
        // Smoothly return parallax to center
        this.targetPos.x = 0;
        this.targetPos.y = 0;
        
        // Start animation to return to center
        if (!this.animationFrame) {
            this.animationFrame = requestAnimationFrame(this.animateParallax);
        }
        
        // Set a delay before hiding the handle
        this.hoverTimeoutRef = setTimeout(() => {
            const { onHoverChange, website } = this.props;
            if (onHoverChange) {
                onHoverChange(website.id, false, null);
            }
        }, 3000); // Stay visible for 3 seconds after mouse leaves
    }
    
    /**
     * Animate parallax effect for iframe
     */
    animateParallax = () => {
        if (!this.iframeRef.current) {
            this.animationFrame = null;
            return;
        }
        
        // Smooth interpolation
        const smoothing = 0.1;
        this.currentPos.x += (this.targetPos.x - this.currentPos.x) * smoothing;
        this.currentPos.y += (this.targetPos.y - this.currentPos.y) * smoothing;
        
        // Apply transform
        this.iframeRef.current.style.transform = `scale(0.5) translate(${this.currentPos.x}px, ${this.currentPos.y}px)`;
        
        // Continue animation if there's significant movement
        const distance = Math.abs(this.targetPos.x - this.currentPos.x) + Math.abs(this.targetPos.y - this.currentPos.y);
        if (distance > 0.1) {
            this.animationFrame = requestAnimationFrame(this.animateParallax);
        } else {
            this.animationFrame = null;
        }
    }
    
    /**
     * Handle mouse move for parallax
     */
    handleMouseMove = (e) => {
        if (!this.state.isHovered || !this.hexRef.current) return;
        
        const rect = this.hexRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Calculate target position with damping
        const offsetX = e.clientX - centerX;
        const offsetY = e.clientY - centerY;
        const dampingFactor = 0.3;
        
        // Update target
        this.targetPos.x = -offsetX * dampingFactor;
        this.targetPos.y = -offsetY * dampingFactor;
        
        // Start animation if not running
        if (!this.animationFrame) {
            this.animationFrame = requestAnimationFrame(this.animateParallax);
        }
    }
    
    /**
     * Override drag data to include website info
     */
    getDragData() {
        return {
            ...super.getDragData(),
            website: this.props.website
        };
    }
    
    /**
     * Override drag start
     */
    onDragStart() {
        // Notify parent to show global drag ghost
        const { setDragGhost, website } = this.props;
        if (setDragGhost) {
            setDragGhost({ visible: true, website });
        }
    }
    
    /**
     * Override drag end
     */
    onDragEnd() {
        // Hide the drag ghost
        const { setDragGhost } = this.props;
        if (setDragGhost) {
            setDragGhost({ visible: false, website: null });
        }
    }
    
    /**
     * Handle tile click - lock to website
     */
    handleTileClick(e) {
        const { isWebsiteLocked, onLockToWebsite, website, position } = this.props;
        if (!isWebsiteLocked && onLockToWebsite) {
            onLockToWebsite(website.id, position.q, position.r);
        }
    }
    
    /**
     * Handle double click - expand website
     */
    handleTileDoubleClick(e) {
        const { isWebsiteLocked, onExpandWebsite, website, position } = this.props;
        if (isWebsiteLocked && onExpandWebsite) {
            onExpandWebsite(website.id, position.q, position.r);
        }
    }
    
    /**
     * Handle iframe load
     */
    handleIframeLoad = () => {
        this.setState({ isLoading: false, hasError: false });
    }
    
    /**
     * Handle iframe error
     */
    handleIframeError = () => {
        this.setState({ 
            isLoading: false, 
            hasError: true,
            errorType: 'cors'
        });
    }
    
    /**
     * Handle remove website
     */
    handleRemove = (e) => {
        e.stopPropagation();
        const { onRemoveWebsite, website } = this.props;
        if (onRemoveWebsite) {
            onRemoveWebsite(website.id);
        }
        this.setState({ showDeleteConfirm: false });
    }
    
    /**
     * Handle URL update
     */
    handleUrlUpdate = () => {
        const { onUpdateWebsiteUrl, website } = this.props;
        const { editingUrl } = this.state;
        if (onUpdateWebsiteUrl && editingUrl !== website.url) {
            onUpdateWebsiteUrl(website.id, editingUrl);
        }
        this.setState({ showEditUrl: false });
    }
    
    /**
     * Render website content
     */
    renderContent() {
        const { website, isWebsiteLocked, lodState } = this.props;
        const { isLoading, hasError, errorType, showDeleteConfirm, showEditUrl, editingUrl, isDragging } = this.state;
        const shouldShowActions = lodState?.capabilities?.showActions || false;
        
        return (
            <>
                <div 
                    ref={this.hexRef}
                    className={`hex-website ${isWebsiteLocked ? 'in-locked-mode' : ''} ${isDragging ? 'hex-website-being-dragged' : ''}`}
                    onMouseMove={this.handleMouseMove}
                    style={{
                        animationDelay: `${this.props.index * 200}ms`,
                        opacity: isDragging ? 0.3 : 1
                    }}
                >
                    {/* Double-click overlay for website locked mode */}
                    {isWebsiteLocked && (
                        <div
                            className="hex-website-doubleclick-overlay"
                            onDoubleClick={this.handleTileDoubleClick}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 10,
                                cursor: 'pointer'
                            }}
                            title="Double-click to expand"
                        />
                    )}

                    {/* Website Content */}
                    <div 
                        className="hex-website-content"
                        style={{ cursor: 'pointer' }}
                    >
                        {isLoading && (
                            <div className="hex-website-loading">
                                <div className="hex-website-spinner"></div>
                                <span>Loading...</span>
                            </div>
                        )}
                        
                        {hasError && (
                            <div className="hex-website-error">
                                <ExternalLink className="w-6 h-6" />
                                <span className="hex-website-url">{website.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                                <span className="hex-website-error-text">Failed to load</span>
                            </div>
                        )}
                        
                        {!hasError && (
                            <iframe
                                ref={this.iframeRef}
                                src={website.url}
                                className="hex-website-iframe"
                                onLoad={this.handleIframeLoad}
                                onError={this.handleIframeError}
                                title={`Website: ${website.url}`}
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                style={{ 
                                    display: isLoading ? 'none' : 'block',
                                    transform: 'scale(0.5) translate(0px, 0px)',
                                    pointerEvents: isWebsiteLocked ? 'auto' : 'none'
                                }}
                            />
                        )}
                    </div>

                    {/* Website Actions - Internal remove button only */}
                    {shouldShowActions && (
                        <div className="hex-website-actions">
                            <button
                                onClick={this.handleRemove}
                                className="hex-website-action-button hex-website-remove"
                                title="Remove website"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Website URL Display with Edit Button */}
                    <div className="hex-website-footer" style={{ position: 'relative', zIndex: 15 }}>
                        <span className="hex-website-url-display">
                            {website.url.replace(/^https?:\/\//, '').split('/')[0]}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                this.setState({ showEditUrl: true });
                            }}
                            className="hex-website-edit-button"
                            title="Edit URL"
                        >
                            <Edit2 className="w-2.5 h-2.5" />
                        </button>
                    </div>
                </div>
                
                {/* Modals */}
                {showDeleteConfirm && (
                    <CompactModal
                        title="Remove Website?"
                        onClose={() => this.setState({ showDeleteConfirm: false })}
                        actions={[
                            {
                                label: 'Cancel',
                                onClick: () => this.setState({ showDeleteConfirm: false })
                            },
                            {
                                label: 'Remove',
                                onClick: this.handleRemove,
                                variant: 'danger'
                            }
                        ]}
                    >
                        <p>Are you sure you want to remove this website?</p>
                    </CompactModal>
                )}
                
                {showEditUrl && (
                    <CompactModal
                        title="Edit URL"
                        onClose={() => this.setState({ showEditUrl: false })}
                        actions={[
                            {
                                label: 'Cancel',
                                onClick: () => this.setState({ showEditUrl: false })
                            },
                            {
                                label: 'Update',
                                onClick: this.handleUrlUpdate,
                                variant: 'primary'
                            }
                        ]}
                    >
                        <input
                            type="url"
                            value={editingUrl}
                            onChange={(e) => this.setState({ editingUrl: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(0, 0, 0, 0.5)',
                                color: 'white'
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    this.handleUrlUpdate();
                                }
                            }}
                            autoFocus
                        />
                    </CompactModal>
                )}
            </>
        );
    }
    
    /**
     * Render LoD placeholder
     */
    renderLoDPlaceholder() {
        const { website } = this.props;
        
        return (
            <div className="hex-website" style={{
                animationDelay: `${this.props.index * 200}ms`
            }}>
                <div className="hex-website-placeholder">
                    <ExternalLink className="w-12 h-12" />
                    <div className="hex-placeholder-lines">
                        <div className="hex-placeholder-line hex-placeholder-line-1"></div>
                        <div className="hex-placeholder-line hex-placeholder-line-2"></div>
                    </div>
                </div>
            </div>
        );
    }
}

export default HexWebsiteDraggable;