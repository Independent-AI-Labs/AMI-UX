import React, { useMemo } from 'react';

const GridSelection = React.memo(({ x, y, hexSize, visible }) => {
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;

    const selectionStyle = useMemo(() => ({
        left: x - hexSize,
        top: y - hexSize,
        width: hexWidth,
        height: hexHeight,
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none', // Don't interfere with mouse events
        transition: 'opacity 0.15s ease-out',
    }), [x, y, hexSize, hexWidth, hexHeight, visible]);

    return (
        <div
            className="absolute grid-selection"
            style={selectionStyle}
        />
    );
});

GridSelection.displayName = 'GridSelection';

export default GridSelection;