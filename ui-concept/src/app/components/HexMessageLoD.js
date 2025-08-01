import React from 'react';
import { Bot, User } from 'lucide-react';

const HexMessageLoD = React.memo(({ message }) => {
    return (
        <div className={`hex-message ${message.sender === 'user' ? 'hex-message-user' : 'hex-message-ai'}`} 
             style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {/* Bigger Avatar */}
            <div className={`hex-avatar ${message.sender === 'user' ? 'hex-avatar-user' : 'hex-avatar-ai'}`}
                 style={{ padding: '12px', marginBottom: '12px' }}>
                {message.sender === 'user' ?
                    <User className="w-12 h-12 text-gray-800" /> :
                    <Bot className="w-12 h-12 text-gray-900" />
                }
            </div>

            {/* Placeholder Content */}
            <div className="hex-content-lod">
                <div className="hex-placeholder-line hex-placeholder-line-1"></div>
                <div className="hex-placeholder-line hex-placeholder-line-2"></div>
                <div className="hex-placeholder-line hex-placeholder-line-3"></div>
            </div>
        </div>
    );
});

HexMessageLoD.displayName = 'HexMessageLoD';

export default HexMessageLoD;