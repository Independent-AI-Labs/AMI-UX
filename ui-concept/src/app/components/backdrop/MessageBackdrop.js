"use client";

import React from 'react';

const MessageBackdrop = ({ 
    messages, 
    viewState, 
    hexSize, 
    hexToPixel, 
    getMessagePosition,
    showInput = false,
    inputPosition = null
}) => {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 5 // Behind content but above video
        }}>
            {messages.map((message, index) => {
                let position;
                if (message.q !== undefined && message.r !== undefined) {
                    position = { q: message.q, r: message.r };
                } else {
                    position = getMessagePosition(message, index);
                }
                
                const pixelPosition = hexToPixel(position.q, position.r);
                // In 3D space, positions are relative to the transform container
                const transformedX = pixelPosition.x - hexSize;
                const transformedY = pixelPosition.y - hexSize;
                const transformedSize = hexSize * 2;
                
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
                            boxShadow: '0 0.5rem 2rem rgba(0, 0, 0, 0.4)',
                            zIndex: 10,
                            pointerEvents: 'none'
                        }}
                    />
                );
            })}
            
            {/* Input tile backdrop */}
            {showInput && inputPosition && (
                <div
                    style={{
                        position: 'absolute',
                        left: hexToPixel(inputPosition.q, inputPosition.r).x - hexSize,
                        top: hexToPixel(inputPosition.q, inputPosition.r).y - hexSize,
                        width: hexSize * 2,
                        height: hexSize * 2 * Math.sqrt(3) / 2,
                        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                        background: 'rgba(200, 230, 255, 0.4)',
                        backdropFilter: 'blur(12px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                        boxShadow: '0 0.5rem 2rem rgba(0, 0, 0, 0.4)',
                        zIndex: 10,
                        pointerEvents: 'none'
                    }}
                />
            )}
        </div>
    );
};

export default MessageBackdrop;