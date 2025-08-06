"use client";

import React, { Component } from 'react';

/**
 * Base class for all tile components (messages, websites, etc.)
 * Provides common functionality like viewport culling, positioning, and interaction handling
 */
class BaseTile extends Component {
    constructor(props) {
        super(props);
        
        this.state = {
            isVisible: true,
            isHovered: false,
            isExpanded: false
        };
        
        this.tileRef = React.createRef();
        this.lastVisibilityCheck = 0;
        this.visibilityCheckInterval = 100; // ms between visibility checks
    }
    
    componentDidMount() {
        this.checkVisibility();
        if (this.props.enableViewportCulling !== false) {
            window.addEventListener('scroll', this.handleScroll);
            window.addEventListener('resize', this.handleResize);
        }
    }
    
    componentWillUnmount() {
        if (this.props.enableViewportCulling !== false) {
            window.removeEventListener('scroll', this.handleScroll);
            window.removeEventListener('resize', this.handleResize);
        }
    }
    
    componentDidUpdate(prevProps) {
        // Check visibility when position or viewport changes
        if (prevProps.viewState !== this.props.viewState ||
            prevProps.position.x !== this.props.position.x ||
            prevProps.position.y !== this.props.position.y) {
            this.checkVisibility();
        }
    }
    
    /**
     * Check if tile is within viewport
     */
    checkVisibility = () => {
        const now = Date.now();
        if (now - this.lastVisibilityCheck < this.visibilityCheckInterval) {
            return;
        }
        this.lastVisibilityCheck = now;
        
        if (!this.props.position || !this.props.viewState) return;
        
        const { x, y } = this.props.position;
        const { viewState, hexSize } = this.props;
        
        // Calculate screen position
        const screenX = x * viewState.zoom + viewState.x;
        const screenY = y * viewState.zoom + viewState.y;
        
        // Check if within viewport with some padding
        const padding = hexSize * 2;
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
    
    handleScroll = () => {
        requestAnimationFrame(this.checkVisibility);
    };
    
    handleResize = () => {
        this.checkVisibility();
    };
    
    /**
     * Common mouse enter handler
     */
    handleMouseEnter = (e) => {
        this.setState({ isHovered: true });
        if (this.props.onMouseEnter) {
            this.props.onMouseEnter(e);
        }
    };
    
    /**
     * Common mouse leave handler
     */
    handleMouseLeave = (e) => {
        this.setState({ isHovered: false });
        if (this.props.onMouseLeave) {
            this.props.onMouseLeave(e);
        }
    };
    
    /**
     * Common click handler
     */
    handleClick = (e) => {
        // Don't handle clicks during drag
        if (this.props.isDragging || (this.props.dragRef && this.props.dragRef.current)) {
            return;
        }
        
        if (this.props.onClick) {
            this.props.onClick(e);
        }
    };
    
    /**
     * Get base tile styles
     */
    getBaseTileStyle() {
        const { position, hexSize, viewState } = this.props;
        const { isVisible } = this.state;
        
        return {
            position: 'absolute',
            left: position.x - hexSize,
            top: position.y - hexSize,
            width: hexSize * 2,
            height: hexSize * 2,
            display: isVisible ? 'block' : 'none',
            pointerEvents: this.props.isDragging ? 'none' : 'auto',
            willChange: 'transform',
            transition: 'opacity 0.2s ease-out'
        };
    }
    
    /**
     * Get content wrapper styles
     */
    getContentWrapperStyle() {
        const { isHovered } = this.state;
        
        return {
            width: '100%',
            height: '100%',
            position: 'relative',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.2s ease-out',
            cursor: this.props.isDragging ? 'grab' : 'pointer'
        };
    }
    
    /**
     * Check if tile should be interactive
     */
    isInteractive() {
        return !this.props.isDragging && 
               !(this.props.dragRef && this.props.dragRef.current) &&
               this.state.isVisible;
    }
    
    /**
     * Render method to be implemented by subclasses
     */
    render() {
        throw new Error('BaseTile render() must be implemented by subclass');
    }
}

// Default props
BaseTile.defaultProps = {
    hexSize: 65,
    enableViewportCulling: true
};

export default BaseTile;