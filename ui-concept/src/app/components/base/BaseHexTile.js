"use client";

import React, { Component } from 'react';
import Hexagon from '../Hexagon';
import { LoDHexWrapper } from '../LoD';

/**
 * Base class for hexagonal tiles using Template Method pattern
 * Child classes must implement:
 * - getClassName() - returns CSS classes for the tile
 * - getContentClassName() - returns CSS classes for content
 * - renderContent() - renders the tile content
 * - getBackdropColor() - returns backdrop color
 * 
 * Optional overrides:
 * - getStyle() - additional inline styles
 * - handleTileClick() - click handler
 * - shouldShowContent() - visibility logic
 */
class BaseHexTile extends Component {
    constructor(props) {
        super(props);
        
        this.state = {
            isVisible: true, // Start visible to avoid flicker
            isHovered: false
        };
    }
    
    componentDidMount() {
        this.checkVisibility();
        // Don't use interval - rely on prop changes only
    }
    
    componentWillUnmount() {
        // Clean up if needed
    }
    
    componentDidUpdate(prevProps) {
        // Only check visibility if viewport actually changed
        if (prevProps.viewState?.x !== this.props.viewState?.x ||
            prevProps.viewState?.y !== this.props.viewState?.y ||
            prevProps.viewState?.zoom !== this.props.viewState?.zoom) {
            this.checkVisibility();
        }
    }
    
    /**
     * Check if tile is within viewport (same logic as GridRenderer)
     */
    checkVisibility = () => {
        if (!this.props.position || !this.props.viewState) {
            return;
        }
        
        const { x, y } = this.props.position;
        const { viewState, hexSize = 65 } = this.props;
        
        // Same calculation as GridRenderer
        const screenX = x * viewState.zoom + viewState.x;
        const screenY = y * viewState.zoom + viewState.y;
        
        // Same padding as GridRenderer
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
    
    handleMouseEnter = () => {
        this.setState({ isHovered: true });
        if (this.props.onMouseEnter) {
            this.props.onMouseEnter();
        }
    }
    
    handleMouseLeave = () => {
        this.setState({ isHovered: false });
        if (this.props.onMouseLeave) {
            this.props.onMouseLeave();
        }
    }
    
    handleClick = (e) => {
        e.stopPropagation();
        if (this.props.isDragging || (this.props.dragRef && this.props.dragRef.current)) {
            return;
        }
        this.handleTileClick(e);
    };
    
    handleDoubleClick = (e) => {
        e.stopPropagation();
        if (this.props.isDragging || (this.props.dragRef && this.props.dragRef.current)) {
            return;
        }
        this.handleTileDoubleClick(e);
    };
    
    /**
     * Template methods to be implemented by subclasses
     */
    getClassName() {
        throw new Error('getClassName() must be implemented by subclass');
    }
    
    getContentClassName() {
        return '';
    }
    
    renderContent() {
        throw new Error('renderContent() must be implemented by subclass');
    }
    
    getBackdropColor() {
        return 'rgba(255, 255, 255, 0.4)';
    }
    
    /**
     * Optional template methods
     */
    getStyle() {
        const { index = 0 } = this.props;
        const { isHovered } = this.state;
        
        return {
            animationDelay: `${index * 200}ms`,
            zIndex: isHovered ? 2000 : 1000,
            pointerEvents: this.props.isDragging ? 'none' : 'auto'
        };
    }
    
    handleTileClick(e) {
        // Default: do nothing, override in subclass
    }
    
    handleTileDoubleClick(e) {
        // Default: do nothing, override in subclass
    }
    
    shouldShowContent() {
        return this.state.isVisible;
    }
    
    /**
     * Final render method using template methods
     */
    render() {
        if (!this.shouldShowContent()) {
            return null;
        }
        
        const { position, hexSize, lodState } = this.props;
        const { x, y, q, r } = position;
        
        return (
            <LoDHexWrapper lodState={lodState} hexType={this.getHexType()}>
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
                >
                    {this.renderContent()}
                </Hexagon>
            </LoDHexWrapper>
        );
    }
    
    /**
     * Helper to get hex type for LoD wrapper
     */
    getHexType() {
        return 'base';
    }
}

export default BaseHexTile;