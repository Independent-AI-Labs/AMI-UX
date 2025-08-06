import React, { useState } from 'react';

const IconButton = ({ 
    id, 
    Icon, 
    size, 
    primary, 
    isActive, 
    isHovered,
    onClick,
    onMouseEnter,
    onMouseLeave 
}) => {
    const [isClicked, setIsClicked] = useState(false);
    
    const handleClick = () => {
        setIsClicked(true);
        setTimeout(() => setIsClicked(false), 200);
        onClick();
    };
    // For active state, we need a wrapper to isolate from parent blend mode
    if (isActive) {
        return (
            <div 
                style={{
                    position: 'relative',
                    isolation: 'isolate',
                    mixBlendMode: 'normal'
                }}
            >
                <button
                    key={id}
                    onClick={handleClick}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    className="glass-control-button"
                    style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: primary ? '16px' : '50%',
                        padding: 0,
                        transform: isClicked ? 'scale(0.9) translateY(-12px) translateZ(0)' : 'scale(1.1) translateY(-12px) translateZ(0)',
                        WebkitTransform: isClicked ? 'scale(0.9) translateY(-12px) translateZ(0)' : 'scale(1.1) translateY(-12px) translateZ(0)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 16px 32px rgba(0, 0, 0, 0.4), 0 0 48px rgba(255, 255, 255, 0.6)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <Icon 
                        size={size * 0.5} 
                        color="white"
                        strokeWidth={primary ? 2.5 : 2}
                    />
                </button>
            </div>
        );
    }

    // Normal state - inherits screen blend mode from parent
    return (
        <button
            key={id}
            onClick={handleClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                position: 'relative',
                width: `${size}px`,
                height: `${size}px`,
                background: 'white',
                borderRadius: primary ? '16px' : '50%',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isClicked ? 'scale(0.9)' : isHovered ? `scale(${primary ? 1.15 : 1.1}) translateY(-${primary ? 8 : 4}px)` : 'scale(1)',
                boxShadow: isHovered ? 
                    '0 12px 24px rgba(0, 0, 0, 0.3), 0 0 32px rgba(255, 255, 255, 0.5)' : 
                    '0 8px 20px rgba(0, 0, 0, 0.25)',
                opacity: 1,
                mixBlendMode: 'screen'
            }}
        >
            <Icon 
                size={size * 0.5} 
                color="black"
                strokeWidth={primary ? 2.5 : 2}
                style={{
                    mixBlendMode: 'multiply'
                }}
            />
        </button>
    );
};

export default IconButton;