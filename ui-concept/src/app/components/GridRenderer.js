'use client';

import React, { useMemo, useState, useEffect } from 'react';
import gridSystem from '../core/GridSystem';
import viewportSystem from '../core/ViewportSystem';
import tileManager from '../tileManager';

/**
 * GridRenderer - Renders the hex grid dots in screen space for constant size
 */
const GridRenderer = ({ viewState }) => {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);
    // Update viewport system with current state
    useMemo(() => {
        viewportSystem.updateViewState(viewState);
        if (typeof window !== 'undefined') {
            viewportSystem.updateScreenDimensions(window.innerWidth, window.innerHeight);
        }
    }, [viewState]);
    
    // Calculate which grid positions are visible and their screen positions
    const screenSpaceDots = useMemo(() => {
        const dots = [];
        
        // Check if we're on the client side
        if (typeof window === 'undefined') {
            return dots;
        }
        
        const hexSize = 65; // Same as tiles
        const padding = hexSize * 2; // Same padding as tiles
        
        // Check all grid positions but only render visible ones
        for (let q = 0; q < 32; q++) {
            for (let r = 0; r < 16; r++) {
                if (!tileManager.isTileOccupied(q, r)) {
                    const worldPos = gridSystem.gridToWorld(q, r);
                    
                    // Convert to screen space - EXACT same calculation as BaseTile
                    const screenX = worldPos.x * viewState.zoom + viewState.x;
                    const screenY = worldPos.y * viewState.zoom + viewState.y;
                    
                    // Check if within viewport with same padding as tiles
                    const isVisible = (
                        screenX >= -padding &&
                        screenX <= window.innerWidth + padding &&
                        screenY >= -padding &&
                        screenY <= window.innerHeight + padding
                    );
                    
                    if (isVisible) {
                        dots.push({
                            id: `grid_dot_${q}_${r}`,
                            x: screenX,
                            y: screenY
                        });
                    }
                }
            }
        }
        
        return dots;
    }, [viewState.x, viewState.y, viewState.zoom]);
    
    // Only render dots after client mount to avoid hydration mismatch
    if (!mounted) {
        return (
            <div 
                className="grid-renderer"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 1,
                    transform: 'none'
                }}
            />
        );
    }
    
    return (
        <div 
            className="grid-renderer"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
                // Render in screen space, not affected by parent transforms
                transform: 'none'
            }}
        >
            {screenSpaceDots.map(dot => (
                <div
                    key={dot.id}
                    className="grid-dot"
                    style={{
                        position: 'absolute',
                        left: dot.x - 1,
                        top: dot.y - 1,
                        width: 2,
                        height: 2,
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        borderRadius: '50%',
                        willChange: 'transform'
                    }}
                />
            ))}
        </div>
    );
};

export default React.memo(GridRenderer);