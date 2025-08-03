import React, { useMemo } from 'react';
import gridSystem from '../core/GridSystem';
import viewportSystem from '../core/ViewportSystem';
import tileManager from '../tileManager';

/**
 * GridRenderer - Renders the hex grid using unified coordinate system
 */
const GridRenderer = ({ viewState }) => {
    // Update viewport system with current state
    useMemo(() => {
        viewportSystem.updateViewState(viewState);
        if (typeof window !== 'undefined') {
            viewportSystem.updateScreenDimensions(window.innerWidth, window.innerHeight);
        }
    }, [viewState]);
    
    // Get ALL grid positions for debugging - no viewport culling
    const visibleHexes = useMemo(() => {
        console.log('GridRenderer: Rendering ALL positions for debugging');
        const allPositions = [];
        
        // Generate all 32x16 positions
        for (let q = 0; q < 32; q++) {
            for (let r = 0; r < 16; r++) {
                if (!tileManager.isTileOccupied(q, r)) {
                    const worldPos = gridSystem.gridToWorld(q, r);
                    const screenX = viewState.x + worldPos.x * viewState.zoom;
                    const screenY = viewState.y + worldPos.y * viewState.zoom;
                    
                    allPositions.push({
                        id: `grid_hex_${q}_${r}`,
                        q: q,
                        r: r,
                        screenX: screenX,
                        screenY: screenY,
                        size: gridSystem.hexSize * viewState.zoom
                    });
                }
            }
        }
        
        console.log('GridRenderer: Generated positions count:', allPositions.length);
        return allPositions;
    }, [viewState]);
    
    return (
        <div 
            className="grid-renderer"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1 // Ensure background dots are behind content
            }}
        >
            {visibleHexes.map(hex => {
                const hexWidth = hex.size * 2;
                const hexHeight = Math.sqrt(3) * hex.size;
                
                return (
                    <div
                        key={hex.id}
                        className="grid-hex"
                        style={{
                            position: 'absolute',
                            left: hex.screenX - 1,
                            top: hex.screenY - 1,
                            width: 2,
                            height: 2,
                            backgroundColor: 'rgba(255, 255, 255, 0.25)',
                            borderRadius: '50%',
                            transform: 'translateZ(0)', // Force hardware acceleration
                            willChange: 'transform'
                        }}
                    />
                );
            })}
        </div>
    );
};

export default GridRenderer;