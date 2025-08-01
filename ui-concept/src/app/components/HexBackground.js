import React from 'react';
import Hexagon from './Hexagon';

const HexBackground = React.memo(({ q, r, x, y, hexSize }) => {
    return (
        <Hexagon
            q={q}
            r={r}
            x={x}
            y={y}
            hexSize={hexSize}
            className="hex-background"
        />
    );
});

HexBackground.displayName = 'HexBackground';

export default HexBackground;