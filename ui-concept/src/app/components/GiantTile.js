import React, { useState, useEffect, useRef } from 'react';

const GiantTile = ({ 
    tile,
    tileType, // 'message' or 'website'
    onClose,
    renderContent // Function that renders the appropriate content component
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        
        // Wait for blur out animation
        setTimeout(() => {
            if (onClose) {
                onClose();
            }
        }, 150); // Quick blur out
    };


    useEffect(() => {
        // Blur in animation
        requestAnimationFrame(() => {
            setIsVisible(true);
        });

        // ESC key handler
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

    // Calculate viewport dimensions - MAXIMUM SIZE!!!  
    const viewportSize = Math.min(window.innerWidth, window.innerHeight) * 1.1; // Even bigger than viewport!
    const finalHexSize = viewportSize / 2;

    // Different colors based on tile type
    const getBackgroundColor = () => {
        switch (tileType) {
            case 'message':
                return tile.sender === 'user' 
                    ? 'rgba(144, 192, 255, 0.95)' 
                    : 'rgba(255, 255, 255, 0.95)';
            case 'website':
                return 'black'; // Black background for screen blend mode alpha masking
            case 'input':
                return 'rgba(144, 192, 255, 0.95)'; // User color for input
            default:
                return 'rgba(255, 255, 255, 0.95)';
        }
    };

    const getBorderColor = () => {
        switch (tileType) {
            case 'message':
                return tile.sender === 'user' 
                    ? 'rgba(144, 192, 255, 0.8)' 
                    : 'rgba(255, 255, 255, 0.8)';
            case 'website':
                return 'rgba(224, 224, 224, 0.8)'; // Light gray border to define the white hex
            case 'input':
                return 'rgba(144, 192, 255, 0.8)'; // User color for input
            default:
                return 'rgba(255, 255, 255, 0.8)';
        }
    };

    // Create elongated hex for websites (2x wider with extended vertical sides)
    const getClipPath = () => {
        if (tileType === 'website') {
            // Wide hex: extend the vertical left/right sides while keeping proper hex angles
            // Normal hex angles are 30°, so we keep the corner angles but extend the straight sides
            return 'polygon(12.5% 0%, 87.5% 0%, 100% 25%, 100% 75%, 87.5% 100%, 12.5% 100%, 0% 75%, 0% 25%)';
        }
        // Normal hex for messages
        return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
    };

    const hexStyle = {
        position: 'fixed',
        left: '50%',
        top: '50%',
        width: tileType === 'website' ? finalHexSize * 2.5 : finalHexSize * 2, // Wider for websites
        height: finalHexSize * Math.sqrt(3),
        transform: 'translate(-50%, -50%)',
        clipPath: tileType === 'website' ? 'none' : getClipPath(), // No clipping for websites
        zIndex: 10000,
        opacity: isVisible && !isClosing ? 1 : 0,
        filter: isVisible && !isClosing ? 'blur(0px)' : 'blur(10px)',
        transition: 'opacity 0.15s ease, filter 0.15s ease',
        background: tileType === 'website' ? 'transparent' : getBackgroundColor(), // Transparent for websites
        backdropFilter: tileType === 'website' ? 'none' : 'blur(20px)', // No backdrop blur for websites
        border: tileType === 'website' ? 'none' : `3px solid ${getBorderColor()}`, // No border for websites
        boxShadow: tileType === 'website' ? 'none' : '0 20px 60px rgba(0, 0, 0, 0.3)', // No shadow for websites
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: tileType === 'website' ? '1.25rem' : '0' // Add padding for websites
    };

    return (
        <>
            {/* Background overlay */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 9999,
                    opacity: isVisible && !isClosing ? 1 : 0,
                    transition: 'opacity 0.15s ease'
                }}
                onClick={handleClose}
            />

            {/* Giant Hexagon */}
            <div style={hexStyle}>
                {renderContent()}
            </div>
        </>
    );
};

export default GiantTile;