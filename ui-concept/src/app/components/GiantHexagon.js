import React from 'react';
import GiantTile from './GiantTile';
import MessageContent from './MessageContent';

const GiantHexagon = ({ 
    message, 
    onClose, 
    renderMarkdown 
}) => {
    const renderContent = () => (
        <MessageContent
            message={message}
            renderMarkdown={renderMarkdown}
            isLocked={true}
            showActions={true}
            showTimestamps={true}
            showAvatars={true}
            size="expanded"
        />
    );

    return (
        <GiantTile
            tile={message}
            tileType="message"
            onClose={onClose}
            renderContent={renderContent}
        />
    );
};

export default GiantHexagon;