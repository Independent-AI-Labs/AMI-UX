import React, { useCallback, useMemo } from 'react';
import Hexagon from './Hexagon';
import HexMessageTransition from './HexMessageTransition';

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
            />
        </Hexagon>
    );
});

HexMessage.displayName = 'HexMessage';

export default HexMessage;