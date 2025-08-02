import React from 'react';
import { Send, User } from 'lucide-react';

const InputContent = ({ 
    inputText,
    onInputChange,
    onSendMessage,
    size = 'normal' // normal, expanded
}) => {
    const sizeClasses = {
        normal: {
            fontSize: '8px',
            iconSize: 'w-3 h-3',
            avatarSize: 'w-3 h-3'
        },
        expanded: {
            fontSize: '16px',
            iconSize: 'w-6 h-6',
            avatarSize: 'w-8 h-8'
        }
    };

    const currentSize = sizeClasses[size];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputText.trim() && onSendMessage) {
            onSendMessage(inputText.trim());
        }
    };

    return (
        <div className={`input-content ${size}`}>
            {/* Avatar */}
            <div className="hex-avatar hex-avatar-user">
                <User className={`${currentSize.avatarSize} text-gray-800`} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="input-form">
                <textarea
                    value={inputText}
                    onChange={(e) => onInputChange && onInputChange(e.target.value)}
                    placeholder={size === 'expanded' ? "Type your message here..." : "Type..."}
                    className="input-textarea"
                    style={{
                        fontSize: currentSize.fontSize,
                        height: size === 'expanded' ? '200px' : '60px'
                    }}
                    rows={size === 'expanded' ? 8 : 3}
                />
                
                {inputText.trim() && (
                    <button
                        type="submit"
                        className="send-button"
                        title="Send message"
                    >
                        <Send className={currentSize.iconSize} />
                    </button>
                )}
            </form>
        </div>
    );
};

export default InputContent;