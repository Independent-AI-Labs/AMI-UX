import React, { useEffect, useState } from 'react';

const ErrorToast = ({ message, visible, onHide, duration = 3000 }) => {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsAnimating(true);
            const timer = setTimeout(() => {
                setIsAnimating(false);
                setTimeout(onHide, 500); // Allow fade out animation
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [visible, duration, onHide]);

    if (!visible && !isAnimating) return null;

    return (
        <div 
            className={`error-toast ${isAnimating ? 'error-toast-visible' : 'error-toast-hidden'}`}
            style={{
                position: 'fixed',
                top: '24px', // Moved up to align with date/clock
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 150, // Above status bar (z-index: 100) but below controls
                pointerEvents: 'none',
                fontSize: '18px', // Smaller to fit in status bar
                fontWeight: '600',
                color: '#ef4444',
                textShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                letterSpacing: '0.5px'
            }}
        >
            {message}
        </div>
    );
};

export default ErrorToast;