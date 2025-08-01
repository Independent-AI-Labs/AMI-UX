import React from 'react';
import { User, Bot, Copy, RotateCw, GitBranch } from 'lucide-react';
import HexMessageLoD from './HexMessageLoD';
import { generateLoDStyles } from './LoD';

const HexMessageTransition = ({ 
    message, 
    useLoD, 
    isLocked, 
    renderMarkdown,
    onCopyMessage,
    lodState
}) => {

    const handleCopy = () => {
        onCopyMessage(message.text);
    };

    // Use LoD system to determine capabilities and styling
    const capabilities = lodState?.capabilities || {};
    const showContent = capabilities.showContent || 'full';
    const showActions = capabilities.showActions && isLocked;
    const showTimestamps = capabilities.showTimestamps !== false;
    const showAvatars = capabilities.showAvatars !== false;
    
    // Generate LoD-based styles
    const lodStyles = lodState ? generateLoDStyles(lodState, 'message') : {};
    
    const renderedText = renderMarkdown(message.text);

    // Show LoD version when content should be placeholder
    if (showContent === 'placeholder') {
        return <HexMessageLoD message={message} />;
    }

    // Show full version - LoD-aware structure
    return (
        <div
            className={`hex-message ${message.sender === 'user' ? 'hex-message-user' : 'hex-message-ai'} ${isLocked ? 'in-locked-mode' : ''}`}
            style={lodStyles}
        >
            {/* Avatar - conditionally shown based on LoD */}
            {showAvatars && (
                <div
                    className={`hex-avatar ${message.sender === 'user' ? 'hex-avatar-user' : 'hex-avatar-ai'}`}>
                    {message.sender === 'user' ?
                        <User className="w-3 h-3 text-gray-800" /> :
                        <Bot className="w-3 h-3 text-gray-900" />
                    }
                </div>
            )}

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
                    className={`hex-text selectable-text ${showContent === 'enhanced' ? 'enhanced-content' : ''}`}
                    dangerouslySetInnerHTML={renderedText}
                />
            </div>
            
            {/* Timestamp - conditionally shown based on LoD */}
            {showTimestamps && (
                <p className="hex-timestamp">
                    {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </p>
            )}

            {/* Message Actions - shown based on LoD capabilities */}
            {showActions && (
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
    );
};

export default HexMessageTransition;