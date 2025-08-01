import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Copy, ClipboardPaste, ChevronRight, MessageSquarePlus } from 'lucide-react';

const ContextMenu = ({ x, y, visible, onClose, canStartNewChat, onStartNewChat }) => {
    const menuRef = useRef(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [ripples, setRipples] = useState([]);
    const [activeSubmenu, setActiveSubmenu] = useState(null);
    const submenuTimeoutRef = useRef(null);

    const menuItems = [
        {
            id: 'new',
            label: 'New...',
            icon: Plus,
            shortcut: 'Ctrl+N',
            hasSubmenu: true,
            submenu: [
                {
                    id: 'new-chat',
                    label: 'New Chat',
                    icon: MessageSquarePlus,
                    disabled: !canStartNewChat,
                },
                {
                    id: 'new-document',
                    label: 'New Document',
                    icon: Plus,
                },
            ]
        },
        {
            id: 'copy',
            label: 'Copy',
            icon: Copy,
            shortcut: 'Ctrl+C',
        },
        {
            id: 'paste',
            label: 'Paste',
            icon: ClipboardPaste,
            shortcut: 'Ctrl+V',
        },
    ];

    // Handle menu animations
    useEffect(() => {
        if (visible) {
            setIsAnimating(true);
            // Trigger entrance animation
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        } else {
            setIsAnimating(false);
        }
    }, [visible]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (visible) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('contextmenu', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('contextmenu', handleClickOutside);
        };
    }, [visible, onClose]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!visible) return;
            
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [visible, onClose]);

    const handleItemClick = (item, event) => {
        if (item.hasSubmenu) {
            // Don't toggle submenu on click - it's handled by hover
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const rippleX = event.clientX - rect.left;
        const rippleY = event.clientY - rect.top;
        
        // Create ripple effect
        const newRipple = {
            id: Date.now(),
            x: rippleX,
            y: rippleY,
        };
        
        setRipples(prev => [...prev, newRipple]);
        
        // Remove ripple after animation
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 600);

        // Handle specific actions
        if (item.id === 'new-chat' && !item.disabled) {
            onStartNewChat();
        }

        setTimeout(() => {
            onClose();
        }, 150);

        console.log(`Context menu action: ${item.id}`);
    };

    const handleItemHover = (item) => {
        // Clear any pending timeout
        if (submenuTimeoutRef.current) {
            clearTimeout(submenuTimeoutRef.current);
            submenuTimeoutRef.current = null;
        }
        
        if (item.hasSubmenu) {
            setActiveSubmenu(item.id);
        } else {
            setActiveSubmenu(null);
        }
    };

    const handleItemLeave = (item) => {
        if (item.hasSubmenu) {
            // Set a delay before closing submenu to allow mouse to move to submenu
            submenuTimeoutRef.current = setTimeout(() => {
                setActiveSubmenu(prev => prev === item.id ? null : prev);
            }, 300); // Reduced delay for better responsiveness
        }
    };

    const handleSubmenuEnter = (parentId) => {
        // Clear any pending timeout and keep submenu open
        if (submenuTimeoutRef.current) {
            clearTimeout(submenuTimeoutRef.current);
            submenuTimeoutRef.current = null;
        }
        setActiveSubmenu(parentId);
    };

    const handleSubmenuLeave = () => {
        // Close submenu immediately when mouse leaves submenu area
        setActiveSubmenu(null);
    };

    const handleMenuLeave = () => {
        // Clear any pending timeout and close submenu
        if (submenuTimeoutRef.current) {
            clearTimeout(submenuTimeoutRef.current);
            submenuTimeoutRef.current = null;
        }
        setActiveSubmenu(null);
    };

    if (!visible) return null;

    // Calculate menu position to keep it in viewport
    const menuWidth = 220;
    const menuHeight = menuItems.length * 44 + 16;
    
    let adjustedX = x;
    let adjustedY = y;
    
    if (typeof window !== 'undefined') {
        if (x + menuWidth > window.innerWidth) {
            adjustedX = window.innerWidth - menuWidth - 8;
        }
        if (y + menuHeight > window.innerHeight) {
            adjustedY = window.innerHeight - menuHeight - 8;
        }
    }

    const menuContent = (
        <div
            ref={menuRef}
            className={`context-menu ${isAnimating ? 'context-menu-entering' : ''}`}
            style={{
                left: adjustedX,
                top: adjustedY,
            }}
            onMouseLeave={handleMenuLeave}
        >
            <div className="context-menu-content">
                {menuItems.map((item, index) => {
                    const IconComponent = item.icon;
                    const isSubmenuOpen = activeSubmenu === item.id;
                    
                    return (
                        <div key={item.id}>
                            <div
                                className={`context-menu-item ${item.disabled ? 'context-menu-item-disabled' : ''} ${isSubmenuOpen ? 'submenu-open' : ''}`}
                                onClick={(e) => !item.disabled && handleItemClick(item, e)}
                                onMouseEnter={() => handleItemHover(item)}
                                onMouseLeave={() => handleItemLeave(item)}
                                style={{
                                    animationDelay: `${index * 30}ms`,
                                }}
                            >
                                {/* Ripple effects */}
                                {ripples.map(ripple => (
                                    <div
                                        key={ripple.id}
                                        className="ripple-effect"
                                        style={{
                                            left: ripple.x,
                                            top: ripple.y,
                                        }}
                                    />
                                ))}
                                
                                <div className="context-menu-item-content">
                                    <div className="context-menu-item-left">
                                        <IconComponent className="context-menu-icon" />
                                        <span className="context-menu-label">{item.label}</span>
                                    </div>
                                    <div className="context-menu-item-right">
                                        {item.shortcut && (
                                            <span className="context-menu-shortcut">{item.shortcut}</span>
                                        )}
                                        {item.hasSubmenu && (
                                            <ChevronRight className={`context-menu-chevron ${isSubmenuOpen ? 'rotated' : ''}`} />
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Submenu */}
                            {item.hasSubmenu && isSubmenuOpen && (
                                <div 
                                    className="context-submenu"
                                    onMouseEnter={() => handleSubmenuEnter(item.id)}
                                    onMouseLeave={handleSubmenuLeave}
                                >
                                    {item.submenu.map((subItem, subIndex) => {
                                        const SubIconComponent = subItem.icon;
                                        return (
                                            <div
                                                key={subItem.id}
                                                className={`context-menu-item context-submenu-item ${subItem.disabled ? 'context-menu-item-disabled' : ''}`}
                                                onClick={(e) => !subItem.disabled && handleItemClick(subItem, e)}
                                                style={{
                                                    animationDelay: `${(index + subIndex + 1) * 30}ms`,
                                                }}
                                            >
                                                <div className="context-menu-item-content">
                                                    <div className="context-menu-item-left">
                                                        <SubIconComponent className="context-menu-icon" />
                                                        <span className="context-menu-label">{subItem.label}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return menuContent;
};

export default ContextMenu;