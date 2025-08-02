import React from 'react';
import GiantTile from './GiantTile';
import InputContent from './InputContent';

const GiantInput = ({ 
    inputText,
    onInputChange,
    onSendMessage,
    onClose 
}) => {
    const renderContent = () => (
        <InputContent
            inputText={inputText}
            onInputChange={onInputChange}
            onSendMessage={onSendMessage}
            size="expanded"
        />
    );

    return (
        <GiantTile
            tile={{ sender: 'user' }} // Fake tile for coloring
            tileType="input"
            onClose={onClose}
            renderContent={renderContent}
        />
    );
};

export default GiantInput;