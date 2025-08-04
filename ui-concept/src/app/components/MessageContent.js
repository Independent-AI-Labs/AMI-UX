import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User, Bot, Copy, RotateCw, GitBranch } from 'lucide-react';

const MessageContent = ({ 
    message, 
    renderMarkdown, 
    isLocked = false,
    showActions = false,
    showTimestamps = true,
    showAvatars = true,
    onCopyMessage,
    size = 'normal' // normal, expanded
}) => {
    const [isMounted, setIsMounted] = useState(false);
    const [hasScrollbar, setHasScrollbar] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const contentRef = useRef(null);
    const isDraggingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const startScrollRef = useRef(0);
    
    useEffect(() => {
        setIsMounted(true);
    }, []);
    
    const renderedText = useMemo(() => renderMarkdown(message.text), [renderMarkdown, message.text]);
    
    // Check for scrollbar after content renders
    useEffect(() => {
        const checkScrollbar = () => {
            if (contentRef.current) {
                setHasScrollbar(contentRef.current.scrollHeight > contentRef.current.clientHeight);
            }
        };
        
        checkScrollbar();
        // Also check after a brief delay to ensure content is rendered
        const timeout = setTimeout(checkScrollbar, 100);
        return () => clearTimeout(timeout);
    }, [renderedText, isLocked, size]);

    // Touch/mouse drag scrolling for markdown content
    const handlePointerDown = (e) => {
        if (!isLocked || size !== 'normal') return;
        
        const content = contentRef.current;
        if (!content || content.scrollHeight <= content.clientHeight) return;
        
        // Only start drag if not clicking on text for selection
        if (e.target.closest('.selectable-text') && !e.shiftKey && !e.ctrlKey) {
            // Allow text selection by default, but start drag after a delay or movement
            const startX = e.clientX;
            const startY = e.clientY;
            
            const checkForDrag = (moveEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - startX);
                const deltaY = Math.abs(moveEvent.clientY - startY);
                
                if (deltaY > 5) { // Movement threshold for drag
                    isDraggingRef.current = true;
                    setIsDragging(true);
                    startPosRef.current = { x: startX, y: startY };
                    startScrollRef.current = content.scrollTop;
                    
                    document.removeEventListener('pointermove', checkForDrag);
                    moveEvent.preventDefault();
                    moveEvent.stopPropagation();
                }
            };
            
            const cleanup = () => {
                document.removeEventListener('pointermove', checkForDrag);
                document.removeEventListener('pointerup', cleanup);
            };
            
            document.addEventListener('pointermove', checkForDrag);
            document.addEventListener('pointerup', cleanup);
            return;
        }
        
        isDraggingRef.current = true;
        setIsDragging(true);
        startPosRef.current = { x: e.clientX, y: e.clientY };
        startScrollRef.current = content.scrollTop;
        
        e.preventDefault();
        e.stopPropagation();
    };

    const handlePointerMove = (e) => {
        if (!isDraggingRef.current || !contentRef.current) return;
        
        const deltaY = e.clientY - startPosRef.current.y;
        const newScrollTop = startScrollRef.current - deltaY;
        
        contentRef.current.scrollTop = Math.max(0, Math.min(
            contentRef.current.scrollHeight - contentRef.current.clientHeight,
            newScrollTop
        ));
        
        e.preventDefault();
        e.stopPropagation();
    };

    const handlePointerUp = (e) => {
        isDraggingRef.current = false;
        setIsDragging(false);
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    // Add global event listeners for drag completion
    useEffect(() => {
        const handleGlobalPointerMove = (e) => handlePointerMove(e);
        const handleGlobalPointerUp = (e) => handlePointerUp(e);

        document.addEventListener('pointermove', handleGlobalPointerMove);
        document.addEventListener('pointerup', handleGlobalPointerUp);
        document.addEventListener('pointercancel', handleGlobalPointerUp);

        return () => {
            document.removeEventListener('pointermove', handleGlobalPointerMove);
            document.removeEventListener('pointerup', handleGlobalPointerUp);
            document.removeEventListener('pointercancel', handleGlobalPointerUp);
        };
    }, []);

    const handleCopy = () => {
        if (onCopyMessage) {
            onCopyMessage(message.text);
        }
    };

    const sizeClasses = {
        normal: {
            avatar: 'w-3 h-3',
            fontSize: '0.5rem',
            lineHeight: '1.4',
            actionIcon: 'w-2 h-2'
        },
        expanded: {
            avatar: 'w-8 h-8',
            fontSize: '1.125rem',
            lineHeight: '1.6',
            actionIcon: 'w-4 h-4'
        }
    };

    const currentSize = sizeClasses[size];

    return (
        <div className={`message-content ${size}`}>
            {/* Avatar */}
            {showAvatars && (
                <div className={`hex-avatar ${message.sender === 'user' ? 'hex-avatar-user' : 'hex-avatar-ai'}`}>
                    {message.sender === 'user' ?
                        <User className={`${currentSize.avatar} text-gray-800`} /> :
                        <Bot className={`${currentSize.avatar} text-gray-900`} />
                    }
                </div>
            )}

            {/* Message Content */}
            <div 
                ref={contentRef}
                className="hex-content"
                onPointerDown={handlePointerDown}
                style={{
                    cursor: isLocked && size === 'normal' && hasScrollbar 
                        ? (isDragging ? 'grabbing' : 'grab') 
                        : 'default',
                    userSelect: isDragging ? 'none' : 'text'
                }}
            >
                <div
                    className="hex-text selectable-text"
                    style={{
                        fontSize: currentSize.fontSize,
                        lineHeight: currentSize.lineHeight
                    }}
                    dangerouslySetInnerHTML={renderedText}
                />
            </div>
            
            {/* Timestamp */}
            {showTimestamps && (
                <p 
                    className="hex-timestamp"
                    style={{
                        fontSize: size === 'expanded' ? '0.875rem' : '0.5rem'
                    }}
                >
                    {isMounted ? (
                        size === 'expanded' 
                            ? message.timestamp.toLocaleString()
                            : message.timestamp.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                    ) : (
                        '00:00'
                    )}
                </p>
            )}

            {/* Message Actions */}
            {showActions && (
                <div className="hex-message-actions">
                    <button
                        className="hex-action-button copy"
                        onClick={handleCopy}
                        title="Copy message"
                    >
                        <Copy className={currentSize.actionIcon} />
                    </button>
                    <button
                        className="hex-action-button rerun"
                        onClick={(e) => e.stopPropagation()}
                        title="Re-run"
                    >
                        <RotateCw className={currentSize.actionIcon} />
                    </button>
                    <button
                        className="hex-action-button branch"
                        onClick={(e) => e.stopPropagation()}
                        title="Branch conversation"
                    >
                        <GitBranch className={currentSize.actionIcon} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default MessageContent;