import React, { useMemo } from 'react';

const Hexagon = React.memo(({ q, r, x, y, hexSize, children, className, onClick, onDoubleClick, style }) => {
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;

    // Back to original positioning approach that was working
    const hexStyle = useMemo(() => ({
        left: x - hexSize,
        top: y - hexSize,
        width: hexWidth,
        height: hexHeight,
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        zIndex: 10, // Ensure hexagons are above video backdrop
        ...style
    }), [x, y, hexSize, hexWidth, hexHeight, style]);

    return (
        <div
            className={`absolute ${className || ''}`}
            style={hexStyle}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
        >
            {children}
        </div>
    );
});

Hexagon.displayName = 'Hexagon';

export default Hexagon;
