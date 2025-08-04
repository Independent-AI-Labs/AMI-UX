import React, { useMemo } from 'react';

const Hexagon = React.memo(({ q, r, x, y, hexSize, children, className, onClick, onDoubleClick, onWheel, style }) => {
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;

    // Separate clip-path (outer) from backdrop-filter (inner)
    const hexStyle = useMemo(() => ({
        left: x - hexSize,
        top: y - hexSize,
        width: hexWidth,
        height: hexHeight,
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        zIndex: 1000,
        willChange: 'transform',
        pointerEvents: 'auto', // Ensure hex can be clicked
        cursor: 'pointer',
        // No background or backdrop-filter here - only clip-path
        ...style
    }), [x, y, hexSize, hexWidth, hexHeight, style]);

    // Handle wheel to prevent blocking
    const handleWheel = (e) => {
        if (onWheel) {
            onWheel(e);
        }
        // Don't stop propagation or prevent default
        // Let the event bubble up naturally
    };

    return (
        <div
            className={`absolute ${className || ''}`}
            style={hexStyle}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onWheel={handleWheel}
        >
            {children}
        </div>
    );
});

Hexagon.displayName = 'Hexagon';

export default Hexagon;
