import React from 'react';

const Hexagon = ({ q, r, x, y, hexSize, children, className, onClick, style }) => {
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;

    return (
        <div
            key={`hex-${q}-${r}`}
            className={`absolute ${className}`}
            style={{
                left: x - hexSize,
                top: y - hexSize,
                width: hexWidth,
                height: hexHeight,
                ...style
            }}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

export default Hexagon;
