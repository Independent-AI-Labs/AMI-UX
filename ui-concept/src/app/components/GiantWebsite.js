import React from 'react';
import GiantTile from './GiantTile';
import WebsiteContent from './WebsiteContent';

const GiantWebsite = ({ 
    website, 
    onClose, 
    onRemoveWebsite 
}) => {
    const renderContent = () => (
        <WebsiteContent
            website={website}
            isLocked={true}
            showActions={true}
            size="expanded"
            onRemoveWebsite={onRemoveWebsite}
        />
    );

    return (
        <GiantTile
            tile={website}
            tileType="website"
            onClose={onClose}
            renderContent={renderContent}
        />
    );
};

export default GiantWebsite;