import React, { useMemo } from 'react';
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
    const renderedText = useMemo(() => renderMarkdown(message.text), [renderMarkdown, message.text]);

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
            <div className="hex-content">
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
                    {size === 'expanded' 
                        ? message.timestamp.toLocaleString()
                        : message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                    }
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