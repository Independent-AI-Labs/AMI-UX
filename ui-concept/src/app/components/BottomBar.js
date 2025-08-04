import React, { useState } from 'react';
import { 
    Home, 
    Search, 
    MessageSquare, 
    FileText, 
    Settings,
    Grid3X3,
    Camera,
    Music
} from 'lucide-react';

const BottomBar = ({ 
    isLocked,
    isWebsiteLocked
}) => {
    const [hoveredButton, setHoveredButton] = useState(null);
    const [activeButton, setActiveButton] = useState(null);

    const handleClick = (id) => {
        setActiveButton(id);
        setTimeout(() => setActiveButton(null), 300);
    };

    if (isLocked || isWebsiteLocked) return null;

    const icons = [
        { id: 'home', Icon: Home, size: 48 },
        { id: 'search', Icon: Search, size: 48 },
        { id: 'chat', Icon: MessageSquare, size: 48 },
        { id: 'grid', Icon: Grid3X3, size: 56, primary: true },
        { id: 'files', Icon: FileText, size: 48 },
        { id: 'camera', Icon: Camera, size: 48 },
        { id: 'music', Icon: Music, size: 48 },
        { id: 'settings', Icon: Settings, size: 48 },
    ];

    return (
        <div 
            className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
            style={{
                isolation: 'isolate',
                mixBlendMode: 'screen'
            }}
        >
            <div className="flex items-center gap-4">
                {icons.map(({ id, Icon, size, primary }) => (
                    <button
                        key={id}
                        onClick={() => handleClick(id)}
                        onMouseEnter={() => setHoveredButton(id)}
                        onMouseLeave={() => setHoveredButton(null)}
                        className="relative group"
                        style={{
                            width: `${size}px`,
                            height: `${size}px`,
                            background: 'white',
                            borderRadius: primary ? '16px' : '50%',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: activeButton === id ? 'scale(0.9)' : 
                                      hoveredButton === id ? `scale(${primary ? 1.15 : 1.1}) translateY(-${primary ? 8 : 4}px)` : 'scale(1)',
                            boxShadow: hoveredButton === id ? 
                                '0 12px 24px rgba(0, 0, 0, 0.3), 0 0 32px rgba(255, 255, 255, 0.5)' : 
                                '0 4px 12px rgba(0, 0, 0, 0.2)',
                            opacity: hoveredButton && hoveredButton !== id ? 0.7 : 1,
                        }}
                    >
                        <Icon 
                            size={size * 0.5} 
                            color="black"
                            strokeWidth={primary ? 2.5 : 2}
                            style={{
                                mixBlendMode: 'multiply',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: hoveredButton === id ? 
                                    (id === 'settings' ? 'rotate(180deg)' : 
                                     id === 'grid' ? 'rotate(45deg)' : 
                                     'scale(1.1)') : 'scale(1)',
                            }}
                        />
                        
                        {/* Ripple effect */}
                        {activeButton === id && (
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: primary ? '16px' : '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'rgba(255, 255, 255, 0.6)',
                                    animation: 'ripple 0.6s ease-out',
                                    pointerEvents: 'none',
                                }}
                            />
                        )}
                        
                        {/* Hover glow */}
                        {hoveredButton === id && (
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: '120%',
                                    height: '120%',
                                    borderRadius: primary ? '20px' : '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                    pointerEvents: 'none',
                                }}
                            />
                        )}
                    </button>
                ))}
            </div>

            <style jsx>{`
                @keyframes ripple {
                    0% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(2.5);
                        opacity: 0;
                    }
                }
                
                @keyframes pulse {
                    0%, 100% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 0.6;
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.2);
                        opacity: 0.3;
                    }
                }
            `}</style>
        </div>
    );
};

export default BottomBar;