"use client";

import React, { Component } from 'react';
import Hexagon from '../Hexagon';
import { LoDHexWrapper } from '../LoD';

/**
 * Base class for draggable hexagonal tiles with comprehensive features
 * 
 * Features:
 * - Viewport culling for performance
 * - Hover animations (scale-up)
 * - LoD (Level of Detail) support with customizable placeholder
 * - Drag and drop (can be disabled)
 * - Separate background and content rendering
 * 
 * Child classes must implement:
 * - getHexType() - returns hex type for LoD wrapper
 * - renderContent() - renders the content layer
 * - renderLoDPlaceholder() - renders simplified content for LoD
 * - getBackdropColor() - returns backdrop color for separate backdrop layer
 * 
 * Child classes can override:
 * - isDraggable() - whether tile can be dragged (default: true)
 * - handleTileClick(e) - handle tile click
 * - handleTileDoubleClick(e) - handle tile double click
 * - getHoverScale() - hover scale factor (default: 1.05)
 * - getCullingPadding() - culling padding in hex sizes (default: 2)
 */
class BaseDraggableTile extends Component {
    constructor(props) {
        super(props);
        
        this.state = {
            isVisible: true, // Start visible to avoid flicker
            isHovered: false,
            isDragging: false
        };
        
        this.dragOffset = { x: 0, y: 0 };
        this.animationFrame = null;
    }
    
    componentDidMount() {
        this.checkVisibility();
    }
    
    componentWillUnmount() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
    
    componentDidUpdate(prevProps) {
        // Check visibility when viewport changes
        if (prevProps.viewState?.x !== this.props.viewState?.x ||
            prevProps.viewState?.y !== this.props.viewState?.y ||
            prevProps.viewState?.zoom !== this.props.viewState?.zoom) {
            this.checkVisibility();
        }
    }
    
    /**
     * Check if tile is within viewport
     */
    checkVisibility = () => {
        if (!this.props.position || !this.props.viewState) {
            return;
        }
        
        const { x, y } = this.props.position;
        const { viewState, hexSize = 65 } = this.props;
        
        // Calculate screen position
        const screenX = x * viewState.zoom + viewState.x;
        const screenY = y * viewState.zoom + viewState.y;
        
        // Culling padding
        const padding = hexSize * this.getCullingPadding();
        const isVisible = (
            screenX >= -padding &&
            screenX <= window.innerWidth + padding &&
            screenY >= -padding &&
            screenY <= window.innerHeight + padding
        );
        
        if (isVisible !== this.state.isVisible) {
            this.setState({ isVisible });
        }
    };
    
    /**
     * Handle mouse enter
     */
    handleMouseEnter = () => {
        this.setState({ isHovered: true });
        if (this.props.onMouseEnter) {
            this.props.onMouseEnter();
        }
        this.onTileHoverStart();
    };
    
    /**
     * Handle mouse leave
     */
    handleMouseLeave = () => {
        this.setState({ isHovered: false });
        if (this.props.onMouseLeave) {
            this.props.onMouseLeave();
        }
        this.onTileHoverEnd();
    };
    
    /**
     * Handle click
     */
    handleClick = (e) => {
        e.stopPropagation();
        if (this.props.isDragging || this.state.isDragging || 
            (this.props.dragRef && this.props.dragRef.current)) {
            return;
        }
        this.handleTileClick(e);
    };
    
    /**
     * Handle double click
     */
    handleDoubleClick = (e) => {
        e.stopPropagation();
        if (this.props.isDragging || this.state.isDragging ||
            (this.props.dragRef && this.props.dragRef.current)) {
            return;
        }
        this.handleTileDoubleClick(e);
    };
    
    /**
     * Handle drag start
     */
    handleDragStart = (e) => {
        if (!this.isDraggable()) return;
        
        e.stopPropagation();
        this.setState({ isDragging: true });
        
        // Calculate initial offset
        const rect = e.currentTarget.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Notify parent
        if (this.props.onDragStart) {
            this.props.onDragStart(this.getDragData());
        }
        
        // Add event listeners
        document.addEventListener('mousemove', this.handleDragMove);
        document.addEventListener('mouseup', this.handleDragEnd);
        
        this.onDragStart();
    };
    
    /**
     * Handle drag move
     */
    handleDragMove = (e) => {
        // Update CSS custom properties for drag ghost
        document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        
        // Allow middle-click for panning
        if (e.button === 1) {
            e.stopPropagation = () => {};
        }
        
        this.onDragMove(e);
    };
    
    /**
     * Handle drag end
     */
    handleDragEnd = (e) => {
        if (e.button !== 0) return; // Only left mouse button
        
        this.setState({ isDragging: false });
        document.removeEventListener('mousemove', this.handleDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
        
        // Calculate drop position
        const dropPosition = this.calculateDropPosition(e);
        
        // For websites, use onMoveWebsite instead of onDrop
        if (dropPosition && this.props.onMoveWebsite && this.getHexType() === 'website') {
            this.props.onMoveWebsite(this.props.id || this.props.website?.id, dropPosition.q, dropPosition.r);
        } else if (dropPosition && this.props.onDrop) {
            this.props.onDrop(this.getDragData(), dropPosition);
        }
        
        // Call subclass hook first
        this.onDragEnd();
        
        // Then notify parent if needed
        if (this.props.onDragEnd) {
            this.props.onDragEnd();
        }
    };
    
    /**
     * Calculate drop position with proper transform handling
     */
    calculateDropPosition(e) {
        const { containerRef, pixelToHex } = this.props;
        const overlayContainer = containerRef?.current;
        if (!overlayContainer) return null;
        
        // The transformed container is the next sibling after the overlay
        const transformedContainer = overlayContainer.nextElementSibling;
        
        if (!transformedContainer) {
            console.error('Could not find main container with transform');
            return null;
        }
        
        const rect = overlayContainer.getBoundingClientRect();
        const containerX = e.clientX - rect.left;
        const containerY = e.clientY - rect.top;
        
        const computedStyle = window.getComputedStyle(transformedContainer);
        const matrix = new DOMMatrix(computedStyle.transform);
        
        // Extract transform values
        const currentZoom = matrix.a;
        const currentX = matrix.e;
        const currentY = matrix.f;
        
        // Convert to world coordinates
        const worldX = (containerX - currentX) / currentZoom;
        const worldY = (containerY - currentY) / currentZoom;
        
        return pixelToHex(worldX, worldY);
    }
    
    /**
     * Get drag data for parent component
     */
    getDragData() {
        return {
            id: this.props.id,
            type: this.getHexType(),
            position: this.props.position
        };
    }
    
    /**
     * Template methods to be implemented/overridden by subclasses
     */
    
    // Required methods
    getHexType() {
        throw new Error('getHexType() must be implemented by subclass');
    }
    
    renderContent() {
        throw new Error('renderContent() must be implemented by subclass');
    }
    
    renderLoDPlaceholder() {
        throw new Error('renderLoDPlaceholder() must be implemented by subclass');
    }
    
    getBackdropColor() {
        throw new Error('getBackdropColor() must be implemented by subclass');
    }
    
    // Optional overrides
    isDraggable() {
        return true;
    }
    
    handleTileClick(e) {
        // Override in subclass
    }
    
    handleTileDoubleClick(e) {
        // Override in subclass
    }
    
    getCullingPadding() {
        return 2; // In hex sizes
    }
    
    useExternalDragHandle() {
        return false; // Override in subclass if using floating handle
    }
    
    useScreenBlendMode() {
        return false; // Override in subclass to enable screen blend mode
    }
    
    // Lifecycle hooks for subclasses
    onTileHoverStart() {
        // Override for hover start behavior
    }
    
    onTileHoverEnd() {
        // Override for hover end behavior
    }
    
    onDragStart() {
        // Override for drag start behavior
    }
    
    onDragMove(e) {
        // Override for drag move behavior
    }
    
    onDragEnd() {
        // Override for drag end behavior
    }
    
    /**
     * Get combined CSS classes
     */
    getClassName() {
        // Match message tile exactly: animate-fade-in hex-with-backdrop
        return `animate-fade-in hex-with-backdrop ${this.getTileClassName()}`.trim();
    }
    
    /**
     * Get tile-specific CSS classes
     */
    getTileClassName() {
        return ''; // Override in subclass (e.g., 'hex-user' for user messages)
    }
    
    /**
     * Get inline styles
     */
    getStyle() {
        const { index = 0 } = this.props;
        const { isHovered, isDragging } = this.state;
        
        // Match message tile styling exactly
        return {
            animationDelay: `${index * 200}ms`,
            zIndex: isHovered ? 2000 : 1000,
            pointerEvents: this.props.isDragging ? 'none' : 'auto',
            // Background and backdrop now handled by separate layer outside transform
        };
    }
    
    /**
     * Render the tile
     */
    render() {
        const { isVisible } = this.state;
        if (!isVisible) {
            return null;
        }
        
        const { position, hexSize, lodState } = this.props;
        const { x, y, q, r } = position;
        
        // Check LoD state
        const useLoD = lodState?.zoom?.config?.showContent === 'placeholder';
        
        return (
            <LoDHexWrapper lodState={lodState} hexType={this.getHexType()} useScreenBlend={this.useScreenBlendMode()}>
                <Hexagon
                    q={q}
                    r={r}
                    x={x}
                    y={y}
                    hexSize={hexSize}
                    className={this.getClassName()}
                    style={this.getStyle()}
                    onClick={this.handleClick}
                    onDoubleClick={this.handleDoubleClick}
                    onMouseEnter={this.handleMouseEnter}
                    onMouseLeave={this.handleMouseLeave}
                    onMouseDown={this.isDraggable() && !this.useExternalDragHandle() ? this.handleDragStart : undefined}
                >
                    {/* Content - render directly like message tiles do */}
                    {useLoD ? this.renderLoDPlaceholder() : this.renderContent()}
                </Hexagon>
            </LoDHexWrapper>
        );
    }
}

export default BaseDraggableTile;