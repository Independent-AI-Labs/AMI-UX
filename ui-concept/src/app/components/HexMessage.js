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
    onCopyMessage,
    renderMarkdown,
    index,
    zoom,
    lodState
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
                className="animate-fade-in hex-with-backdrop"
                style={animationStyle}
                onClick={handleClick}
            >
                <HexMessageTransition
                    message={message}
                    useLoD={useLoD}
                    isLocked={isLocked}
                    renderMarkdown={renderMarkdown}
                    onCopyMessage={onCopyMessage}
                    lodState={lodState}
                />
            </Hexagon>
        </LoDHexWrapper>
    );
});

HexMessage.displayName = 'HexMessage';

export default HexMessage;