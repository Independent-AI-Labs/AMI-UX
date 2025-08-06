"use client";

import React from 'react';
import BaseHexTile from './base/BaseHexTile';
import CompactModal from './CompactModal';
import { ExternalLink, X, ArrowUpRight, Move, Edit2, Trash2 } from 'lucide-react';

/**
 * Optimized HexWebsite component that extends BaseHexTile
 * Inherits viewport culling and base functionality
 * Provides website-specific CSS and rendering
 */
class HexWebsiteOptimized extends BaseHexTile {
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
            editingUrl: props.website.url,
            isDragging: false
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
        if (!this.state.isHovered || !this.iframeRef.current) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
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
     * Provide website-specific CSS classes
     */
    getClassName() {
        const { isWebsiteLocked } = this.props;
        return `animate-fade-in hex-with-backdrop ${isWebsiteLocked ? 'hex-locked' : ''}`;
    }
    
    /**
     * Get hex type for LoD wrapper
     */
    getHexType() {
        return 'website';
    }
    
    
    /**
     * Override style to add animation delay
     */
    getStyle() {
        const baseStyle = super.getStyle();
        const { index = 0 } = this.props;
        
        return {
            ...baseStyle,
            animationDelay: `${index * 200}ms`
        };
    }
    
    /**
     * Override mouse enter from BaseHexTile
     */
    handleMouseEnter = () => {
        // Clear any pending hide timeout
        if (this.hoverTimeoutRef) {
            clearTimeout(this.hoverTimeoutRef);
            this.hoverTimeoutRef = null;
        }
        
        // Set hover state
        this.setState({ isHovered: true });
        
        // Call props handler if exists
        if (this.props.onMouseEnter) {
            this.props.onMouseEnter();
        }
        
        // Notify parent about hover with drag handle
        const { onHoverChange, website, position, hexSize } = this.props;
        if (onHoverChange) {
            onHoverChange(website.id, true, { 
                x: position.x, 
                y: position.y, 
                hexSize, 
                onDragStart: this.handleDragStart 
            });
        }
    }
    
    /**
     * Override mouse leave from BaseHexTile
     */
    handleMouseLeave = () => {
        // Smoothly return to center
        this.targetPos.x = 0;
        this.targetPos.y = 0;
        
        // Start animation to return to center
        if (!this.animationFrame) {
            this.animationFrame = requestAnimationFrame(this.animateParallax);
        }
        
        // Set a delay before hiding the handle  
        this.hoverTimeoutRef = setTimeout(() => {
            // Notify parent
            const { onHoverChange, website } = this.props;
            if (onHoverChange) {
                onHoverChange(website.id, false, null);
            }
        }, 3000); // Stay visible for 3 seconds after mouse leaves
        
        // Clear hover state immediately (not in timeout)
        this.setState({ isHovered: false });
        
        // Call props handler if exists
        if (this.props.onMouseLeave) {
            this.props.onMouseLeave();
        }
    }
    
    /**
     * Handle drag move
     */
    handleDragMove = (e) => {
        // Update CSS custom properties for mouse tracking
        document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        
        // Allow middle-click events to bubble up for panning while dragging
        if (e.button === 1) { // Middle mouse button
            e.stopPropagation = () => {}; // Disable stopPropagation for middle-click
        }
    }
    
    /**
     * Handle drag end
     */
    handleDragEnd = (e) => {
        // Only end drag on left mouse button up (button 0)
        if (e.button !== 0) {
            return;
        }
        
        console.log('Drag ended for website:', this.props.website.id);
        this.setState({ isDragging: false });
        document.removeEventListener('mousemove', this.handleDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
        
        
        // Determine drop position with proper transform handling
        const { containerRef, pixelToHex, onMoveWebsite, website } = this.props;
        const overlayContainer = containerRef?.current;
        if (!overlayContainer) {
            console.error('No container ref for drop calculation');
            return;
        }
        
        // Find the transformed container
        const transformedContainer = overlayContainer.querySelector('.main-content') || 
                                    overlayContainer.querySelector('[style*="transform"]');
        
        if (!transformedContainer) {
            console.error('Could not find main container with transform');
            return;
        }
        
        const rect = overlayContainer.getBoundingClientRect();
        const containerX = e.clientX - rect.left;
        const containerY = e.clientY - rect.top;
        
        console.log('Container coordinates:', { containerX, containerY, rect });
        
        const computedStyle = window.getComputedStyle(transformedContainer);
        const matrix = new DOMMatrix(computedStyle.transform);
        
        // Extract current zoom and translation
        const currentZoom = matrix.a; // scale x
        const currentX = matrix.e; // translate x  
        const currentY = matrix.f; // translate y
        
        // Convert container position to world coordinates using current transform
        const worldX = (containerX - currentX) / currentZoom;
        const worldY = (containerY - currentY) / currentZoom;
        
        console.log('Drop position (current transform):', { 
            screenX: e.clientX, 
            screenY: e.clientY, 
            containerX, 
            containerY, 
            currentZoom,
            currentX,
            currentY,
            worldX, 
            worldY 
        });
        
        // Use the proper pixelToHex function from the parent
        const hexCoords = pixelToHex(worldX, worldY);
        
        console.log('Calculated hex position:', hexCoords);
        if (onMoveWebsite) {
            onMoveWebsite(website.id, hexCoords.q, hexCoords.r);
        }
    }
    
    /**
     * Handle drag start for Move handle
     */
    handleDragStart = (e) => {
        e.stopPropagation();
        console.log('Drag started for website:', this.props.website.id);
        this.setState({ isDragging: true });
        
        // Notify parent to show global drag ghost
        const { setDragGhost, website } = this.props;
        if (setDragGhost) {
            setDragGhost(website);
        }
        
        document.addEventListener('mousemove', this.handleDragMove);
        document.addEventListener('mouseup', this.handleDragEnd);
    }
    
    /**
     * Handle website click - lock to website
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
    };
    
    /**
     * Handle iframe error
     */
    handleIframeError = () => {
        this.setState({ 
            isLoading: false, 
            hasError: true,
            errorType: 'cors'
        });
    };
    
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
    };
    
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
    };
    
    /**
     * Render website content
     */
    renderContent() {
        const { website, isWebsiteLocked, lodState } = this.props;
        const { isLoading, hasError, errorType, showDeleteConfirm, showEditUrl, editingUrl } = this.state;
        const { isHovered } = this.state;
        
        // Use LoD for simplified rendering
        const useLoD = lodState?.zoom?.config?.showContent === 'placeholder';
        const shouldShowActions = lodState?.capabilities?.showActions || false;
        
        
        return (
            <>
                <div 
                    ref={this.hexRef}
                    className={`hex-website ${isWebsiteLocked ? 'in-locked-mode' : ''} ${this.state.isDragging ? 'hex-website-being-dragged' : ''}`}
                    onMouseMove={this.handleMouseMove}
                    style={{
                        animationDelay: `${this.props.index * 200}ms`,
                        opacity: this.state.isDragging ? 0.3 : 1
                    }}
                >
                    {!useLoD ? (
                        <>
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
                        </>
                    ) : (
                        // LoD placeholder
                        <div className="hex-website-placeholder">
                            <ExternalLink className="w-12 h-12" />
                            <div className="hex-placeholder-lines">
                                <div className="hex-placeholder-line hex-placeholder-line-1"></div>
                                <div className="hex-placeholder-line hex-placeholder-line-2"></div>
                            </div>
                        </div>
                    )}
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
}

export default HexWebsiteOptimized;