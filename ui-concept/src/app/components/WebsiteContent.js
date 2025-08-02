import React, { useState, useCallback } from 'react';
import { ExternalLink, X, ArrowUpRight, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import CompactModal from './CompactModal';

const WebsiteContent = ({ 
    website, 
    isLocked = false,
    showActions = false,
    size = 'normal', // normal, expanded
    onRemoveWebsite,
    isLoading = false,
    hasError = false,
    errorType = 'generic'
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingUrl, setEditingUrl] = useState(false);
    const [urlValue, setUrlValue] = useState(website.url);
    const sizeClasses = {
        normal: {
            fontSize: '8px',
            iconSize: 'w-6 h-6',
            actionIcon: 'w-3 h-3'
        },
        expanded: {
            fontSize: '16px',
            iconSize: 'w-16 h-16',
            actionIcon: 'w-6 h-6'
        }
    };

    const currentSize = sizeClasses[size];

    const handleOpenWebsite = () => {
        window.open(website.url, '_blank');
    };

    const handleRemove = useCallback((e) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (onRemoveWebsite) {
            onRemoveWebsite(website.id);
        }
        setShowDeleteConfirm(false);
    }, [onRemoveWebsite, website.id]);

    return (
        <div className={`website-content ${size}`}>
            {/* Website Icon/Iframe */}
            <div className="website-display" style={{ position: 'relative' }}>
                {hasError ? (
                    <div className="website-error">
                        <ExternalLink className={`${currentSize.iconSize} text-gray-600 mb-2`} />
                        <div 
                            className="error-text"
                            style={{ fontSize: currentSize.fontSize }}
                        >
                            {errorType === 'xframe' ? 'Site blocks embedding' : 'Failed to load'}
                        </div>
                        <button
                            onClick={handleOpenWebsite}
                            className="open-button"
                            style={{ fontSize: currentSize.fontSize }}
                        >
                            Open
                        </button>
                    </div>
                ) : (
                    <>
                        {isLoading && (
                            <div className="website-loading">
                                <ExternalLink className={`${currentSize.iconSize} text-gray-400`} />
                                <div 
                                    className="loading-text"
                                    style={{ fontSize: currentSize.fontSize }}
                                >
                                    Loading...
                                </div>
                            </div>
                        )}
                        <iframe
                            src={website.url}
                            title={`Website: ${website.url}`}
                            className="website-iframe"
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                opacity: isLoading ? 0 : 1
                            }}
                            onLoad={() => {
                                // Handle load in parent component
                            }}
                            onError={() => {
                                // Handle error in parent component  
                            }}
                        />
                        
                        {/* Address Bar at bottom */}
                        {showActions && (
                            <div className="website-address-bar">
                                <button className="nav-button" title="Go back">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button className="nav-button" title="Go forward">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <div className="address-input-container">
                                    {editingUrl ? (
                                        <input
                                            type="text"
                                            value={urlValue}
                                            onChange={(e) => setUrlValue(e.target.value)}
                                            onBlur={() => setEditingUrl(false)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    setEditingUrl(false);
                                                    // TODO: Navigate to new URL
                                                }
                                                if (e.key === 'Escape') {
                                                    setUrlValue(website.url);
                                                    setEditingUrl(false);
                                                }
                                            }}
                                            className="address-input"
                                            autoFocus
                                        />
                                    ) : (
                                        <div 
                                            className="address-display"
                                            onClick={() => setEditingUrl(true)}
                                        >
                                            {website.url}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        // TODO: Navigate to URL
                                        setEditingUrl(false);
                                    }}
                                    className="go-button"
                                    title="Navigate to URL"
                                >
                                    Go
                                </button>
                                <button
                                    onClick={handleOpenWebsite}
                                    className="action-button open"
                                    title="Open in new tab"
                                >
                                    <ArrowUpRight className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={handleRemove}
                                    className="action-button remove"
                                    title="Remove website"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Website URL - only show in normal size, not expanded */}
            {size !== 'expanded' && (
                <div 
                    className="website-url"
                    style={{ fontSize: currentSize.fontSize }}
                >
                    {website.url}
                </div>
            )}


            {/* Delete Confirmation Modal */}
            <CompactModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                message={`Are you sure you want to remove this website tile?`}
                type="warning"
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
};

export default WebsiteContent;