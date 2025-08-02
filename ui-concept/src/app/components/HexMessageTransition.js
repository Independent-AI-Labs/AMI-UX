import React from 'react';
import HexMessageLoD from './HexMessageLoD';
import MessageContent from './MessageContent';
import { generateLoDStyles } from './LoD';

const HexMessageTransition = ({ 
    message, 
    useLoD, 
    isLocked, 
    renderMarkdown,
    onCopyMessage,
    onCloseExpanded,
    lodState
}) => {

    // Use LoD system to determine capabilities and styling
    const capabilities = lodState?.capabilities || {};
    const showContent = capabilities.showContent || 'full';
    const showActions = capabilities.showActions && isLocked;
    const showTimestamps = capabilities.showTimestamps !== false;
    const showAvatars = capabilities.showAvatars !== false;
    const isExpanded = lodState?.context?.level === 'message' && lodState?.context?.messageId === message.id;
    
    // Generate LoD-based styles
    const lodStyles = lodState ? generateLoDStyles(lodState, 'message') : {};

    // Show LoD version when content should be placeholder
    if (showContent === 'placeholder') {
        return <HexMessageLoD message={message} />;
    }

    // Show full version - using MessageContent component
    return (
        <div
            className={`hex-message ${message.sender === 'user' ? 'hex-message-user' : 'hex-message-ai'} ${isLocked ? 'in-locked-mode' : ''}`}
            style={lodStyles}
            onWheel={(e) => {
                if (isLocked) {
                    const element = e.currentTarget.querySelector('.hex-content');
                    if (element) {
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
                }
            }}
        >
            <MessageContent
                message={message}
                renderMarkdown={renderMarkdown}
                isLocked={isLocked}
                showActions={showActions}
                showTimestamps={showTimestamps}
                showAvatars={showAvatars}
                onCopyMessage={onCopyMessage}
                size="normal"
            />
        </div>
    );
};

export default HexMessageTransition;