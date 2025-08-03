import React, { useMemo } from 'react';
import tileManager from '../tileManager';

const GridDots = ({ viewState, screenCenter, hexToPixel, hexSize }) => {
    // Calculate which tiles are visible and generate dots
    const visibleDots = useMemo(() => {
        if (!screenCenter || !hexToPixel) return [];
        
        const dots = [];
        const { x: viewX, y: viewY, zoom } = viewState;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Calculate the world space bounds that are currently visible
        const leftEdge = (-viewX) / zoom;
        const rightEdge = (screenWidth - viewX) / zoom;
        const topEdge = (-viewY) / zoom;
        const bottomEdge = (screenHeight - viewY) / zoom;
        
        // Convert bounds to approximate hex grid range
        // Add some padding to ensure we cover all visible tiles
        const padding = hexSize * 2;
        const minWorldX = leftEdge - padding;
        const maxWorldX = rightEdge + padding;
        const minWorldY = topEdge - padding;
        const maxWorldY = bottomEdge + padding;
        
        // Use the actual tile manager's hexToPixel conversion for accurate positions
        // Generate a grid range based on visible area
        const gridRange = 50; // Check tiles in a reasonable range around center
        const centerTile = tileManager.pixelToHex(
            (screenWidth / 2 - viewX) / zoom,
            (screenHeight / 2 - viewY) / zoom
        );
        
        // Generate dots for visible hex tiles using tile manager coordinates
        for (let q = centerTile.q - gridRange; q <= centerTile.q + gridRange; q++) {
            for (let r = centerTile.r - gridRange; r <= centerTile.r + gridRange; r++) {
                // Skip if tile is occupied
                if (tileManager.isTileOccupied(q, r)) {
                    continue;
                }
                
                // Get exact tile center using tile manager's conversion
                const tileCenter = tileManager.hexToPixel(q, r);
                
                // Convert to screen coordinates
                const screenX = viewX + tileCenter.x * zoom;
                const screenY = viewY + tileCenter.y * zoom;
                
                // Only add if it's actually on screen (with margin)
                if (screenX >= -50 && screenX <= screenWidth + 50 &&
                    screenY >= -50 && screenY <= screenHeight + 50) {
                    dots.push({
                        id: `dot_${q}_${r}`,
                        x: screenX,
                        y: screenY,
                        q,
                        r
                    });
                }
            }
        }
        
        return dots;
    }, [viewState, screenCenter, hexToPixel, hexSize]);
    
    return (
        <div 
            className="grid-dots"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 15 // Above background, below UI content
            }}
        >
            {visibleDots.map(dot => (
                <div
                    key={dot.id}
                    className="grid-dot"
                    style={{
                        position: 'absolute',
                        left: dot.x - 1, // Center the 2px dot
                        top: dot.y - 1,
                        width: '2px',
                        height: '2px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        transform: 'translate(0, 0)', // Force hardware acceleration
                        willChange: 'transform'
                    }}
                />
            ))}
        </div>
    );
};

export default GridDots;