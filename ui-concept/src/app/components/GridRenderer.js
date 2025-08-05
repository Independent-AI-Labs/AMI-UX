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
    
    // Get ALL grid positions - memoized for performance
    const visibleHexes = useMemo(() => {
        const allPositions = [];
        
        // Generate all 32x16 positions
        for (let q = 0; q < 32; q++) {
            for (let r = 0; r < 16; r++) {
                if (!tileManager.isTileOccupied(q, r)) {
                    const worldPos = gridSystem.gridToWorld(q, r);
                    
                    allPositions.push({
                        id: `grid_hex_${q}_${r}`,
                        q: q,
                        r: r,
                        worldX: worldPos.x,
                        worldY: worldPos.y
                    });
                }
            }
        }
        
        return allPositions;
    }, []); // Grid positions don't change, only their rendering does
    
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
                return (
                    <div
                        key={hex.id}
                        className="grid-hex"
                        style={{
                            position: 'absolute',
                            left: hex.worldX,
                            top: hex.worldY,
                            width: 2 / viewState.zoom,
                            height: 2 / viewState.zoom,
                            backgroundColor: 'rgba(255, 255, 255, 0.25)',
                            borderRadius: '50%',
                            transform: `translate(-${1 / viewState.zoom}px, -${1 / viewState.zoom}px) translateZ(0)`,
                            willChange: 'transform'
                        }}
                    />
                );
            })}
        </div>
    );
};

export default GridRenderer;