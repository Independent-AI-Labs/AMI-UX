import React from 'react';
import { Bot } from 'lucide-react';
import Hexagon from './Hexagon';

const TypingIndicator = ({ position, hexSize }) => {
    const { x, y } = position;

    return (
        <Hexagon
            q={position.q}
            r={position.r}
            x={x}
            y={y}
            hexSize={hexSize}
            className="animate-fade-in"
        >
            <div className="hex-message hex-message-ai">
                <div className="hex-avatar hex-avatar-ai">
                    <Bot className="w-3 h-3 text-white/90" />
                </div>
                <div className="hex-content">
                    <div className="flex space-x-1 justify-center">
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                             style={{ animationDelay: '200ms' }}></div>
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                             style={{ animationDelay: '400ms' }}></div>
                    </div>
                </div>
            </div>
        </Hexagon>
    );
};

export default TypingIndicator;