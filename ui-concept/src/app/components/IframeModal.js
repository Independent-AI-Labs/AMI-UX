import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

const IframeModal = ({ isOpen, onClose, onCreateWebsite }) => {
    const [url, setUrl] = useState('');
    const [iframeUrl, setIframeUrl] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef(null);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setUrl('');
            setIframeUrl('');
            setError('');
            setIsLoading(false);
        }
    }, [isOpen]);

    const validateUrl = (inputUrl) => {
        try {
            const urlObj = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
            return urlObj.href;
        } catch {
            return null;
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        
        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }

        const validUrl = validateUrl(url.trim());
        if (!validUrl) {
            setError('Please enter a valid URL');
            return;
        }

        // Create the website hex tile instead of showing iframe in modal
        onCreateWebsite(validUrl);
    };

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    const handleIframeError = () => {
        setIsLoading(false);
        setError('Failed to load the webpage. The site may not allow embedding.');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="iframe-modal-overlay" onClick={onClose}>
            <div className="iframe-modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="iframe-modal-form" onClick={(e) => e.stopPropagation()}>
                    <form onSubmit={handleSubmit}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter URL..."
                            className="iframe-url-input"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {error && (
                            <div className="iframe-error">
                                <AlertCircle className="w-3 h-3" />
                                {error}
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default IframeModal;