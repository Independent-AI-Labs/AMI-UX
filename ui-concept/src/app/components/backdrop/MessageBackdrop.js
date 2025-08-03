"use client";

import React from 'react';

const MessageBackdrop = ({ 
    messages, 
    viewState, 
    hexSize, 
    hexToPixel, 
    getMessagePosition 
}) => {
    return (
        <>
            {messages.map((message, index) => {
                let position;
                if (message.q !== undefined && message.r !== undefined) {
                    position = { q: message.q, r: message.r };
                } else {
                    position = getMessagePosition(message, index);
                }
                
                const pixelPosition = hexToPixel(position.q, position.r);
                const transformedX = viewState.x + (pixelPosition.x - hexSize) * viewState.zoom;
                const transformedY = viewState.y + (pixelPosition.y - hexSize) * viewState.zoom;
                const transformedSize = hexSize * 2 * viewState.zoom;
                
                return (
                    <div
                        key={`backdrop-${message.id}`}
                        style={{
                            position: 'absolute',
                            left: transformedX,
                            top: transformedY,
                            width: transformedSize,
                            height: transformedSize * Math.sqrt(3) / 2,
                            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                            background: message.sender === 'user' ? 'rgba(144, 192, 255, 0.4)' : 'rgba(255, 255, 255, 0.4)',
                            backdropFilter: 'blur(12px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                            zIndex: 10,
                            pointerEvents: 'none'
                        }}
                    />
                );
            })}
        </>
    );
};

export default MessageBackdrop;