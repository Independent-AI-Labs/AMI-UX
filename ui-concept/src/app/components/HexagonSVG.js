import React from 'react';

const HexagonSVG = React.memo(() => {
    return (
        <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
            <defs>
                <clipPath id="hexagon-clip" clipPathUnits="objectBoundingBox">
                    <polygon points="0.25,0 0.75,0 1,0.5 0.75,1 0.25,1 0,0.5" />
                </clipPath>
            </defs>
        </svg>
    );
});

HexagonSVG.displayName = 'HexagonSVG';

export default HexagonSVG;