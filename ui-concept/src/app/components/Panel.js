import React from 'react';
import { X } from 'lucide-react';

const Panel = ({ 
    isOpen, 
    onClose, 
    position = 'left', // left, right, center
    title = 'Panel',
    children 
}) => {
    // Handle ESC key
    React.useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isOpen, onClose]);
    const getPositionStyles = () => {
        if (position === 'center') {
            return {
                left: '10%',
                top: '10%',
                width: '80%',
                height: '80%',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
            };
        } else if (position === 'right') {
            return {
                right: 0,
                top: '60px',
                width: '40%',
                height: 'calc(100vh - 160px)',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                borderRadius: '20px 0 0 20px',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            };
        } else {
            // left
            return {
                left: 0,
                top: '60px',
                width: '40%',
                height: 'calc(100vh - 160px)',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                borderRadius: '0 20px 20px 0',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            };
        }
    };

    const positionStyles = getPositionStyles();

    return (
        <div 
            style={{
                position: 'fixed',
                background: 'rgba(255, 255, 255, 0.05)',
                zIndex: position === 'center' ? 45 : 40,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isOpen ? '0 0 50px rgba(0, 0, 0, 0.1)' : 'none',
                ...positionStyles,
                // Animate filter separately for smooth blur transition
                filter: isOpen ? 'blur(0)' : 'blur(8px)',
                backdropFilter: isOpen ? 'blur(20px) saturate(180%)' : 'blur(0px)',
                WebkitBackdropFilter: isOpen ? 'blur(20px) saturate(180%)' : 'blur(0px)',
                // Use CSS animation for smoother timing control
                animation: isOpen ? 'panelFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' : '',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '24px 32px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
            }}>
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)',
                    margin: 0,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}>{title}</h2>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                    }}
                >
                    <X size={24} color="rgba(255, 255, 255, 0.6)" />
                </button>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '24px',
            }}>
                {children}
            </div>
            
            <style jsx>{`
                @keyframes panelFadeIn {
                    0% {
                        opacity: 0;
                        filter: blur(8px);
                    }
                    60% {
                        opacity: 0.5;
                        filter: blur(4px);
                    }
                    100% {
                        opacity: 1;
                        filter: blur(0);
                    }
                }
                
                @keyframes panelFadeOut {
                    from {
                        opacity: 1;
                        filter: blur(0);
                    }
                    to {
                        opacity: 0;
                        filter: blur(8px);
                    }
                }
            `}</style>
        </div>
    );
};

export default Panel;