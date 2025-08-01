import React, { useCallback, useMemo } from 'react';
import { Bot, User, Copy, RotateCw, GitBranch } from 'lucide-react';
import Hexagon from './Hexagon';
import HexMessageLoD from './HexMessageLoD';

const HexMessage = React.memo(({ 
    message, 
    position, 
    hexSize, 
    isLocked, 
    dragRef, 
    onLockToConversation,
    onCopyMessage,
    renderMarkdown,
    index,
    zoom 
}) => {
    const { x, y } = position;

    const handleClick = useCallback((e) => {
        e.stopPropagation();
        if (!isLocked && !dragRef.current) {
            onLockToConversation(position.q, position.r);
        }
    }, [isLocked, dragRef, onLockToConversation, position.q, position.r]);

    const handleCopy = useCallback((e) => {
        e.stopPropagation();
        onCopyMessage(message.text);
    }, [onCopyMessage, message.text]);

    const animationStyle = useMemo(() => ({ 
        animationDelay: `${index * 200}ms` 
    }), [index]);

    const renderedText = useMemo(() => renderMarkdown(message.text), [renderMarkdown, message.text]);
    
    // Use Level of Detail when zoom is below 80%
    const useLoD = zoom < 0.8;
    const shouldShowActions = !useLoD && isLocked;

    return (
        <Hexagon
            key={message.id}
            q={position.q}
            r={position.r}
            x={x}
            y={y}
            hexSize={hexSize}
            className="animate-fade-in"
            style={animationStyle}
            onClick={handleClick}
        >
            {useLoD ? (
                <HexMessageLoD message={message} />
            ) : (
                <div
                    className={`hex-message ${message.sender === 'user' ? 'hex-message-user' : 'hex-message-ai'} ${isLocked ? 'in-locked-mode' : ''}`}
                >
                    {/* Avatar */}
                    <div
                        className={`hex-avatar ${message.sender === 'user' ? 'hex-avatar-user' : 'hex-avatar-ai'}`}>
                        {message.sender === 'user' ?
                            <User className="w-3 h-3 text-cyan-300" /> :
                            <Bot className="w-3 h-3 text-white/90" />
                        }
                    </div>

                    {/* Message Content */}
                    <div
                        className="hex-content"
                        onWheel={(e) => {
                            if (isLocked) {
                                const element = e.currentTarget;
                                const hasScrollbar = element.scrollHeight > element.clientHeight;

                                if (hasScrollbar) {
                                    const isAtTop = element.scrollTop === 0;
                                    const isAtBottom = element.scrollTop >= element.scrollHeight - element.clientHeight;
                                    const scrollingUp = e.deltaY < 0;
                                    const scrollingDown = e.deltaY > 0;

                                    if ((scrollingUp && !isAtTop) || (scrollingDown && !isAtBottom)) {
                                        e.stopPropagation();
                                    }
                                }
                            }
                        }}
                    >
                        <div
                            className="hex-text selectable-text"
                            dangerouslySetInnerHTML={renderedText}
                        />
                    </div>
                    
                    <p className="hex-timestamp">
                        {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>

                    {/* Message Actions - only show when not using LoD and locked */}
                    {shouldShowActions && (
                        <div className="hex-message-actions">
                            <button
                                className="hex-action-button copy"
                                onClick={handleCopy}
                                title="Copy message"
                            >
                                <Copy className="w-2 h-2" />
                            </button>
                            <button
                                className="hex-action-button rerun"
                                onClick={(e) => e.stopPropagation()}
                                title="Re-run"
                            >
                                <RotateCw className="w-2 h-2" />
                            </button>
                            <button
                                className="hex-action-button branch"
                                onClick={(e) => e.stopPropagation()}
                                title="Branch conversation"
                            >
                                <GitBranch className="w-2 h-2" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </Hexagon>
    );
});

HexMessage.displayName = 'HexMessage';

export default HexMessage;