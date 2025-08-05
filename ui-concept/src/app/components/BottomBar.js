import React, { useState } from 'react';
import { 
    Home, 
    Search, 
    MessageSquare, 
    FileText, 
    Settings,
    Grid3X3,
    Music
} from 'lucide-react';
import ChatPanel from './ChatPanel';
import Panel from './Panel';

const BottomBar = ({ 
    isLocked,
    isWebsiteLocked
}) => {
    const [hoveredButton, setHoveredButton] = useState(null);
    const [activeButton, setActiveButton] = useState(null);
    const [activePanels, setActivePanels] = useState(new Set());

    const handleClick = (id) => {
        setActiveButton(id);
        setTimeout(() => setActiveButton(null), 200);
        
        // Toggle panel
        setActivePanels(prev => {
            const newPanels = new Set(prev);
            if (newPanels.has(id)) {
                newPanels.delete(id);
            } else {
                // For center panel (grid), close all others
                if (id === 'grid') {
                    return new Set([id]);
                }
                // For left/right panels, close panels on same side
                const isLeftPanel = leftIcons.some(icon => icon.id === id);
                if (isLeftPanel) {
                    leftIcons.forEach(icon => newPanels.delete(icon.id));
                } else {
                    rightIcons.forEach(icon => newPanels.delete(icon.id));
                }
                newPanels.add(id);
            }
            return newPanels;
        });
    };

    if (isLocked || isWebsiteLocked) return null;

    const leftIcons = [
        { id: 'home', Icon: Home, size: 48, title: 'Home' },
        { id: 'search', Icon: Search, size: 48, title: 'Search' },
        { id: 'chat', Icon: MessageSquare, size: 48, title: 'Chat' },
    ];

    const centerIcon = { id: 'grid', Icon: Grid3X3, size: 56, primary: true, title: 'Grid View' };

    const rightIcons = [
        { id: 'files', Icon: FileText, size: 48, title: 'Files' },
        { id: 'music', Icon: Music, size: 48, title: 'Music' },
        { id: 'settings', Icon: Settings, size: 48, title: 'Settings' },
    ];

    const renderIcon = (icon) => {
        const { id, Icon, size, primary } = icon;
        const isActive = activePanels.has(id);
        
        return (
            <button
                key={id}
                onClick={() => handleClick(id)}
                onMouseEnter={() => setHoveredButton(id)}
                onMouseLeave={() => setHoveredButton(null)}
                className="relative group"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'white',
                    backdropFilter: isActive ? 'blur(20px) saturate(180%)' : 'none',
                    WebkitBackdropFilter: isActive ? 'blur(20px) saturate(180%)' : 'none',
                    borderRadius: primary ? '16px' : '50%',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeButton === id ? 'scale(0.9)' : 
                              isActive ? 'scale(1.1) translateY(-12px)' :
                              hoveredButton === id ? `scale(${primary ? 1.15 : 1.1}) translateY(-${primary ? 8 : 4}px)` : 'scale(1)',
                    boxShadow: isActive ? 
                        '0 16px 32px rgba(0, 0, 0, 0.4), 0 0 48px rgba(255, 255, 255, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)' :
                        hoveredButton === id ? 
                        '0 12px 24px rgba(0, 0, 0, 0.3), 0 0 32px rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 
                        '0 8px 20px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    opacity: hoveredButton && hoveredButton !== id && !isActive ? 0.7 : 1,
                    zIndex: isActive ? 41 : 'auto',
                }}
            >
                <Icon 
                    size={size * 0.5} 
                    color={isActive ? 'white' : 'black'}
                    strokeWidth={primary ? 2.5 : 2}
                    style={{
                        mixBlendMode: isActive ? 'normal' : 'multiply',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: hoveredButton === id || isActive ? 
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
                {(hoveredButton === id || isActive) && (
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
        );
    };

    return (
        <>
            {/* Chat Panel */}
            <ChatPanel isOpen={activePanels.has('chat')} onClose={() => {
                setActivePanels(prev => {
                    const newPanels = new Set(prev);
                    newPanels.delete('chat');
                    return newPanels;
                });
            }} />
            
            {/* Other Left Panels */}
            {leftIcons.filter(icon => icon.id !== 'chat').map(icon => (
                <Panel 
                    key={icon.id}
                    isOpen={activePanels.has(icon.id)} 
                    onClose={() => {
                        setActivePanels(prev => {
                            const newPanels = new Set(prev);
                            newPanels.delete(icon.id);
                            return newPanels;
                        });
                    }}
                    position="left"
                    title={icon.title}
                >
                    <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>
                        {icon.title} panel content goes here...
                    </div>
                </Panel>
            ))}
            
            {/* Right Panels */}
            {rightIcons.map(icon => (
                <Panel 
                    key={icon.id}
                    isOpen={activePanels.has(icon.id)} 
                    onClose={() => {
                        setActivePanels(prev => {
                            const newPanels = new Set(prev);
                            newPanels.delete(icon.id);
                            return newPanels;
                        });
                    }}
                    position="right"
                    title={icon.title}
                >
                    <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>
                        {icon.title} panel content goes here...
                    </div>
                </Panel>
            ))}
            
            {/* Grid Panel (Center) */}
            <Panel 
                isOpen={activePanels.has('grid')} 
                onClose={() => {
                    setActivePanels(prev => {
                        const newPanels = new Set(prev);
                        newPanels.delete('grid');
                        return newPanels;
                    });
                }}
                position="center"
                title="Grid View"
            >
                <div style={{ 
                    color: 'rgba(255, 255, 255, 0.8)', 
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%' 
                }}>
                    Grid view content with full overview...
                </div>
            </Panel>
            
            {/* Bottom Bar */}
            <div 
                className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
                style={{
                    isolation: 'isolate',
                    mixBlendMode: 'screen'
                }}
            >
                <div className="flex items-center gap-4">
                    {/* Left group */}
                    <div className="flex items-center gap-3">
                        {leftIcons.map(icon => renderIcon(icon))}
                    </div>
                    
                    {/* Center icon */}
                    {renderIcon(centerIcon)}
                    
                    {/* Right group */}
                    <div className="flex items-center gap-3">
                        {rightIcons.map(icon => renderIcon(icon))}
                    </div>
                </div>
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
        </>
    );
};

export default BottomBar;