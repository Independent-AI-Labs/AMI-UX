import React, { useState, useCallback, useMemo, useRef } from 'react';
import Hexagon from './Hexagon';
import { LoDHexWrapper } from './LoD';
import { ExternalLink, X, ArrowUpRight, Move } from 'lucide-react';

const HexWebsite = React.memo(({ 
    website, 
    position, 
    hexSize, 
    isLocked, 
    dragRef, 
    onLockToConversation,
    onRemoveWebsite,
    onMoveWebsite,
    pixelToHex,
    viewState,
    containerRef,
    index,
    zoom,
    lodState
}) => {
    const { x, y } = position;
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [errorType, setErrorType] = useState('generic');
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const hoverTimeoutRef = useRef(null);

    const handleClick = useCallback((e) => {
        e.stopPropagation();
        console.log('Website tile clicked:', website.id);
        if (!isLocked && !dragRef.current) {
            onLockToConversation(position.q, position.r);
        }
    }, [isLocked, dragRef, onLockToConversation, position.q, position.r, website.id]);

    const handleMouseEnter = useCallback(() => {
        // Clear any pending hide timeout
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setIsHovered(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        // Clear any existing timeout
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        
        // Set a delay before hiding the handle
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 1000); // Stay visible for 1 second after mouse leaves
    }, []);

    const handleRemove = useCallback((e) => {
        e.stopPropagation();
        onRemoveWebsite(website.id);
    }, [onRemoveWebsite, website.id]);

    const handleOpenInNewTab = useCallback((e) => {
        e.stopPropagation();
        window.open(website.url, '_blank', 'noopener,noreferrer');
    }, [website.url]);

    const handleDragStart = useCallback((e) => {
        e.stopPropagation();
        console.log('Drag started for website:', website.id);
        setIsDragging(true);
        
        // Store initial mouse position for offset calculation
        setDragOffset({
            x: e.clientX - x,
            y: e.clientY - y
        });
        
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }, [website.id, x, y]);

    const handleDragMove = useCallback((e) => {
        // Update CSS custom properties for mouse tracking
        document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    }, []);

    const handleDragEnd = useCallback((e) => {
        console.log('Drag ended for website:', website.id);
        setIsDragging(false);
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        
        // Clear mouse tracking CSS properties
        document.documentElement.style.removeProperty('--mouse-x');
        document.documentElement.style.removeProperty('--mouse-y');
        
        // Convert mouse position to hex coordinates and move tile if valid
        if (onMoveWebsite && pixelToHex && viewState && containerRef.current) {
            // Convert screen coordinates to container-relative coordinates
            const rect = containerRef.current.getBoundingClientRect();
            const containerX = e.clientX - rect.left;
            const containerY = e.clientY - rect.top;
            
            // Convert container position to world coordinates
            const worldX = (containerX - viewState.x) / viewState.zoom;
            const worldY = (containerY - viewState.y) / viewState.zoom;
            
            console.log('Drop position:', { 
                screenX: e.clientX, 
                screenY: e.clientY, 
                containerX, 
                containerY, 
                worldX, 
                worldY 
            });
            
            // Use the proper pixelToHex function from the parent
            const hexCoords = pixelToHex(worldX, worldY);
            
            console.log('Calculated hex position:', hexCoords);
            onMoveWebsite(website.id, hexCoords.q, hexCoords.r);
        }
    }, [website.id, onMoveWebsite, dragOffset, handleDragMove, pixelToHex, viewState, containerRef]);

    const handleIframeLoad = useCallback(() => {
        setIsLoading(false);
        setHasError(false);
    }, []);

    const handleIframeError = useCallback((e) => {
        setIsLoading(false);
        setHasError(true);
        // Try to detect X-Frame-Options error
        const domain = website.url.replace(/^https?:\/\//, '').split('/')[0];
        if (domain.includes('x.com') || domain.includes('twitter.com') || 
            domain.includes('facebook.com') || domain.includes('instagram.com') ||
            domain.includes('youtube.com') || domain.includes('google.com')) {
            setErrorType('frame-blocked');
        } else {
            setErrorType('generic');
        }
    }, [website.url]);

    const animationStyle = useMemo(() => ({ 
        animationDelay: `${index * 200}ms` 
    }), [index]);

    // Use LoD system to determine detail level
    const useLoD = lodState?.zoom.config.showContent === 'placeholder';
    const shouldShowActions = lodState?.capabilities.showActions || false;

    return (
        <>
            {/* Drag Handle - Completely outside all clipping */}
            <div 
                className={`hex-website-floating-handle ${isHovered || isLocked ? 'visible' : ''}`}
                style={{
                    position: 'absolute',
                    left: x + hexSize - 12,
                    top: y - 12,
                    zIndex: 1000
                }}
            >
                <button
                    onMouseDown={handleDragStart}
                    className="hex-website-action-button hex-website-drag"
                    title="Drag to move"
                >
                    <Move className="w-3 h-3" />
                </button>
            </div>

            <LoDHexWrapper lodState={lodState} hexType="website">
                <Hexagon
                key={website.id}
                q={position.q}
                r={position.r}
                x={x}
                y={y}
                hexSize={hexSize}
                hexId={website.id}
            >
                <div 
                    className={`hex-website ${isLocked ? 'in-locked-mode' : ''} ${isDragging ? 'hex-website-being-dragged' : ''}`}
                    onClick={handleClick}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    style={animationStyle}
                >
                    {!useLoD ? (
                        <>
                            {/* Website Content */}
                            <div className="hex-website-content">
                                {isLoading && (
                                    <div className="hex-website-loading">
                                        <div className="hex-website-spinner"></div>
                                        <span>Loading...</span>
                                    </div>
                                )}
                                
                                {hasError && (
                                    <div className="hex-website-error">
                                        <ExternalLink className="w-6 h-6" />
                                        <span className="hex-website-url">{website.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                                        {errorType === 'frame-blocked' ? (
                                            <>
                                                <span className="hex-website-error-text">Site blocks embedding</span>
                                                <button 
                                                    className="hex-website-open-button"
                                                    onClick={handleOpenInNewTab}
                                                    title="Open in new tab"
                                                >
                                                    <ArrowUpRight className="w-3 h-3" />
                                                    Open
                                                </button>
                                            </>
                                        ) : (
                                            <span className="hex-website-error-text">Failed to load</span>
                                        )}
                                    </div>
                                )}
                                
                                {!hasError && (
                                    <iframe
                                        src={website.url}
                                        className="hex-website-iframe"
                                        onLoad={handleIframeLoad}
                                        onError={handleIframeError}
                                        title={`Website: ${website.url}`}
                                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                        style={{ display: isLoading ? 'none' : 'block' }}
                                    />
                                )}
                            </div>

                            {/* Website Actions - Internal remove button only */}
                            {shouldShowActions && (
                                <div className="hex-website-actions">
                                    <button
                                        onClick={handleRemove}
                                        className="hex-website-action-button hex-website-remove"
                                        title="Remove website"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            {/* Website URL Display */}
                            <div className="hex-website-footer">
                                <span className="hex-website-url-display">
                                    {website.url.replace(/^https?:\/\//, '').split('/')[0]}
                                </span>
                            </div>
                        </>
                    ) : (
                        // LoD placeholder
                        <div className="hex-website-placeholder">
                            <ExternalLink className="w-12 h-12" />
                            <div className="hex-placeholder-lines">
                                <div className="hex-placeholder-line hex-placeholder-line-1"></div>
                                <div className="hex-placeholder-line hex-placeholder-line-2"></div>
                            </div>
                        </div>
                    )}
                </div>
            </Hexagon>
            
            {/* Full Tile Drag Preview */}
            {isDragging && (
                <div 
                    className="hex-website-drag-preview"
                    style={{
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        pointerEvents: 'none',
                        zIndex: 1000,
                        opacity: 0.7,
                        transform: `translate(calc(var(--mouse-x, 0px) - ${dragOffset.x}px), calc(var(--mouse-y, 0px) - ${dragOffset.y}px))`
                    }}
                >
                    <Hexagon
                        q={0}
                        r={0}
                        x={0}
                        y={0}
                        hexSize={hexSize}
                        hexId={`${website.id}-drag-preview`}
                    >
                        <div className="hex-website hex-website-dragging">
                            <div className="hex-website-content">
                                {isLoading && (
                                    <div className="hex-website-loading">
                                        <div className="hex-website-spinner"></div>
                                        <span>Loading...</span>
                                    </div>
                                )}
                                
                                {hasError && (
                                    <div className="hex-website-error">
                                        <ExternalLink className="w-6 h-6" />
                                        <span className="hex-website-url">{website.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                                        <span className="hex-website-error-text">
                                            {errorType === 'frame-blocked' ? 'Site blocks embedding' : 'Failed to load'}
                                        </span>
                                    </div>
                                )}
                                
                                {!hasError && (
                                    <iframe
                                        src={website.url}
                                        className="hex-website-iframe"
                                        title={`Website: ${website.url}`}
                                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                    />
                                )}
                            </div>
                        </div>
                    </Hexagon>
                </div>
            )}
        </LoDHexWrapper>
        </>
    );
});

HexWebsite.displayName = 'HexWebsite';

export default HexWebsite;