import React from 'react';
import { Send } from 'lucide-react';

const HexInputLoD = React.memo(() => {
    return (
        <div className="hex-input-message-editor" 
             style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div className="hex-content-lod">
                <div className="hex-placeholder-line hex-placeholder-line-1"></div>
                <div className="hex-placeholder-line hex-placeholder-line-2"></div>
            </div>
            <div className="hex-input-lod-button">
                <Send className="w-4 h-4 text-gray-800" />
            </div>
        </div>
    );
});

HexInputLoD.displayName = 'HexInputLoD';

export default HexInputLoD;