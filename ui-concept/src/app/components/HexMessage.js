import React, { useCallback, useMemo } from 'react';
import Hexagon from './Hexagon';
import HexMessageTransition from './HexMessageTransition';
import { LoDHexWrapper } from './LoD';

const HexMessage = React.memo(({ 
    message, 
    position, 
    hexSize, 
    isLocked, 
    dragRef, 
    onLockToConversation,
    onExpandMessage,
    onCloseExpanded,
    onCopyMessage,
    renderMarkdown,
    index,
    zoom,
    lodState,
    onMouseEnter,
    onMouseLeave,
    markdownRenderKey
}) => {
    const { x, y } = position;

    const handleClick = useCallback((e) => {
        e.stopPropagation();
        if (!isLocked && !dragRef.current) {
            onLockToConversation(position.q, position.r);
        }
    }, [isLocked, dragRef, onLockToConversation, position.q, position.r]);

    const handleDoubleClick = useCallback((e) => {
        e.stopPropagation();
        if (isLocked && onExpandMessage) {
            onExpandMessage(message.id, position.q, position.r);
        }
    }, [isLocked, onExpandMessage, message.id, position.q, position.r]);

    const handleCopy = useCallback((e) => {
        e.stopPropagation();
        onCopyMessage(message.text);
    }, [onCopyMessage, message.text]);

    const animationStyle = useMemo(() => ({ 
        animationDelay: `${index * 200}ms` 
    }), [index]);

    // Remove memoization to allow re-rendering on zoom complete
    // const renderedText = useMemo(() => renderMarkdown(message.text), [renderMarkdown, message.text]);
    
    // Use LoD system to determine detail level
    const useLoD = lodState?.zoom.config.showContent === 'placeholder';
    const shouldShowActions = lodState?.capabilities.showActions || false;

    return (
        <LoDHexWrapper lodState={lodState} hexType="message">
            <Hexagon
                key={message.id}
                q={position.q}
                r={position.r}
                x={x}
                y={y}
                hexSize={hexSize}
                className={`animate-fade-in hex-with-backdrop ${message.sender === 'user' ? 'hex-user' : ''}`}
                style={{
                    ...animationStyle
                    // Background and backdrop now handled by separate layer outside transform
                }}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                <HexMessageTransition
                    message={message}
                    useLoD={useLoD}
                    isLocked={isLocked}
                    renderMarkdown={renderMarkdown}
                    onCopyMessage={onCopyMessage}
                    onCloseExpanded={onCloseExpanded}
                    lodState={lodState}
                    markdownRenderKey={markdownRenderKey}
                />
            </Hexagon>
        </LoDHexWrapper>
    );
});

HexMessage.displayName = 'HexMessage';

export default HexMessage;