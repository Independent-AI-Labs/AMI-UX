"use client";

import React from 'react';

const WebsiteBackdrop = ({ 
    websites, 
    viewState, 
    hexSize, 
    hexToPixel
}) => {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 5 // Behind content but above video
        }}>
            {websites.map((website) => {
                const position = { q: website.q, r: website.r };
                const pixelPosition = hexToPixel(position.q, position.r);
                // In 3D space, positions are relative to the transform container
                const transformedX = pixelPosition.x - hexSize;
                const transformedY = pixelPosition.y - hexSize;
                const transformedSize = hexSize * 2;
                
                return (
                    <div
                        key={`backdrop-${website.id}`}
                        className="website-backdrop-hex"
                        style={{
                            position: 'absolute',
                            left: transformedX,
                            top: transformedY,
                            width: transformedSize,
                            height: transformedSize * Math.sqrt(3) / 2,
                            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                            background: 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(12px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                            boxShadow: '0 0.5rem 2rem rgba(0, 0, 0, 0.4)',
                            zIndex: 10,
                            pointerEvents: 'none',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            transform: 'scale(1)',
                            transformOrigin: 'center center'
                        }}
                    />
                );
            })}
        </div>
    );
};

export default React.memo(WebsiteBackdrop);