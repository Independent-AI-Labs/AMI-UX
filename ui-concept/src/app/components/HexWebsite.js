import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Hexagon from './Hexagon';
import { LoDHexWrapper } from './LoD';
import CompactModal from './CompactModal';
import { ExternalLink, X, ArrowUpRight, Move, Edit2, Trash2 } from 'lucide-react';

const HexWebsite = React.memo(({ 
    website, 
    position, 
    hexSize, 
    isLocked, 
    isWebsiteLocked,
    dragRef, 
    onLockToConversation,
    onLockToWebsite,
    onRemoveWebsite,
    onMoveWebsite,
    onExpandWebsite,
    onUpdateWebsiteUrl,
    onDragStart,
    onDragEnd,
    onHoverChange,
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
    const hexRef = useRef(null);
    const iframeRef = useRef(null);
    const currentPos = useRef({ x: 0, y: 0 }); // Current iframe position
    const targetPos = useRef({ x: 0, y: 0 }); // Target position
    const animationFrame = useRef(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEditUrl, setShowEditUrl] = useState(false);
    const [editingUrl, setEditingUrl] = useState(website.url);

    const handleClick = useCallback((e) => {
        e.stopPropagation();
        console.log('Website tile clicked:', website.id);
        if (!isLocked && !isWebsiteLocked && !dragRef.current) {
            // Lock to this specific website
            onLockToWebsite(website.id, position.q, position.r);
        }
    }, [isLocked, isWebsiteLocked, dragRef, onLockToWebsite, website.id, position.q, position.r]);

    const handleDoubleClick = useCallback((e) => {
        e.stopPropagation();
        console.log('Website double-click detected:', {
            websiteId: website.id,
            isLocked,
            isWebsiteLocked,
            hasExpandHandler: !!onExpandWebsite
        });
        if (isWebsiteLocked && onExpandWebsite) {
            onExpandWebsite(website.id, position.q, position.r);
        }
    }, [isWebsiteLocked, onExpandWebsite, website.id, position.q, position.r]);

    // Smooth animation function
    const animateParallax = useCallback(() => {
        if (!iframeRef.current) {
            animationFrame.current = null;
            return;
        }
        
        const lerpFactor = 0.15; // Interpolation speed (higher = more responsive)
        
        // Interpolate towards target
        currentPos.current.x += (targetPos.current.x - currentPos.current.x) * lerpFactor;
        currentPos.current.y += (targetPos.current.y - currentPos.current.y) * lerpFactor;
        
        // Apply transform
        iframeRef.current.style.transform = `scale(0.5) translate(${currentPos.current.x}px, ${currentPos.current.y}px)`;
        
        // Continue animation if there's significant movement
        const distance = Math.abs(targetPos.current.x - currentPos.current.x) + Math.abs(targetPos.current.y - currentPos.current.y);
        if (distance > 0.1) {
            animationFrame.current = requestAnimationFrame(animateParallax);
        } else {
            animationFrame.current = null; // Clean up when done
        }
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (hexRef.current && isHovered) {
            const rect = hexRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Calculate target position with damping
            const offsetX = e.clientX - centerX;
            const offsetY = e.clientY - centerY;
            const dampingFactor = 0.3;
            
            // Update target, don't apply directly
            targetPos.current.x = -offsetX * dampingFactor;
            targetPos.current.y = -offsetY * dampingFactor;
            
            // Start animation if not running
            if (!animationFrame.current) {
                animationFrame.current = requestAnimationFrame(animateParallax);
            }
        }
    }, [isHovered, animateParallax]);

    const handleMouseEnter = useCallback(() => {
        // Clear any pending hide timeout
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setIsHovered(true);
        if (onHoverChange) {
            onHoverChange(website.id, true, { x, y, hexSize, onDragStart: exposedHandleDragStart });
        }
    }, [onHoverChange, website.id, x, y, hexSize]);

    const handleMouseLeave = useCallback(() => {
        // Clear any existing timeout
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        
        // Smoothly return to center
        targetPos.current.x = 0;
        targetPos.current.y = 0;
        
        // Start animation to return to center
        if (!animationFrame.current) {
            animationFrame.current = requestAnimationFrame(animateParallax);
        }
        
        // Set a delay before hiding the handle
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
            if (onHoverChange) {
                onHoverChange(website.id, false, null);
            }
        }, 3000); // Stay visible for 3 seconds after mouse leaves
    }, [onHoverChange, website.id, animateParallax]);

    const handleRemove = useCallback((e) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        onRemoveWebsite(website.id);
        setShowDeleteConfirm(false);
    }, [onRemoveWebsite, website.id]);

    const handleEditUrl = useCallback((e) => {
        e.stopPropagation();
        setEditingUrl(website.url);
        setShowEditUrl(true);
    }, [website.url]);

    const handleSaveUrl = useCallback(() => {
        const validUrl = validateUrl(editingUrl.trim());
        if (validUrl && onUpdateWebsiteUrl) {
            onUpdateWebsiteUrl(website.id, validUrl);
            setShowEditUrl(false);
        }
    }, [editingUrl, onUpdateWebsiteUrl, website.id]);

    const validateUrl = (url) => {
        try {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            new URL(url);
            return url;
        } catch {
            return null;
        }
    };

    const handleOpenInNewTab = useCallback((e) => {
        e.stopPropagation();
        window.open(website.url, '_blank', 'noopener,noreferrer');
    }, [website.url]);

    const handleDragStart = useCallback((e) => {
        e.stopPropagation();
        console.log('Drag started for website:', website.id);
        setIsDragging(true);
        
        // Notify parent to show global drag ghost
        if (onDragStart) {
            onDragStart(website);
        }
        
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }, [website, onDragStart]);

    // Expose drag start for external handle
    const exposedHandleDragStart = useCallback((e) => {
        handleDragStart(e);
    }, [handleDragStart]);

    const handleDragMove = useCallback((e) => {
        // Update CSS custom properties for mouse tracking
        document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        
        // Allow middle-click events to bubble up for panning while dragging
        if (e.button === 1) { // Middle mouse button
            e.stopPropagation = () => {}; // Disable stopPropagation for middle-click
        }
    }, []);

    const handleDragEnd = useCallback((e) => {
        // Only end drag on left mouse button up (button 0)
        if (e.button !== 0) {
            return;
        }
        
        console.log('Drag ended for website:', website.id);
        setIsDragging(false);
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        
        // Clear mouse tracking CSS properties
        document.documentElement.style.removeProperty('--mouse-x');
        document.documentElement.style.removeProperty('--mouse-y');
        
        // Hide global drag ghost
        if (onDragEnd) {
            onDragEnd();
        }
        
        // Convert mouse position to hex coordinates and move tile if valid
        if (onMoveWebsite && pixelToHex && containerRef.current) {
            // Get the CURRENT viewState at drop time, not the one from when drag started
            const currentContainer = containerRef.current;
            const rect = currentContainer.getBoundingClientRect();
            const containerX = e.clientX - rect.left;
            const containerY = e.clientY - rect.top;
            
            // Get current transform from the container's style
            const transformedContainer = currentContainer.querySelector('.absolute.inset-0');
            if (transformedContainer) {
                const computedStyle = window.getComputedStyle(transformedContainer);
                const matrix = new DOMMatrix(computedStyle.transform);
                
                // Extract current zoom and translation
                const currentZoom = matrix.a; // scale x
                const currentX = matrix.e; // translate x  
                const currentY = matrix.f; // translate y
                
                // Convert container position to world coordinates using current transform
                const worldX = (containerX - currentX) / currentZoom;
                const worldY = (containerY - currentY) / currentZoom;
                
                console.log('Drop position (current transform):', { 
                    screenX: e.clientX, 
                    screenY: e.clientY, 
                    containerX, 
                    containerY, 
                    currentZoom,
                    currentX,
                    currentY,
                    worldX, 
                    worldY 
                });
                
                // Use the proper pixelToHex function from the parent
                const hexCoords = pixelToHex(worldX, worldY);
                
                console.log('Calculated hex position:', hexCoords);
                onMoveWebsite(website.id, hexCoords.q, hexCoords.r);
            }
        }
    }, [website.id, onMoveWebsite, onDragEnd, handleDragMove, pixelToHex, containerRef]);

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

    // Cleanup animation frame on unmount
    useEffect(() => {
        return () => {
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        };
    }, []);

    // Use LoD system to determine detail level
    const useLoD = lodState?.zoom.config.showContent === 'placeholder';
    const shouldShowActions = lodState?.capabilities.showActions || false;

    return (
        <>
        <LoDHexWrapper lodState={lodState} hexType="website" className="website-tile">
                <Hexagon
                key={website.id}
                q={position.q}
                r={position.r}
                x={x}
                y={y}
                hexSize={hexSize}
                hexId={website.id}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
            >
                <div 
                    ref={hexRef}
                    className={`hex-website ${isLocked ? 'in-locked-mode' : ''} ${isDragging ? 'hex-website-being-dragged' : ''}`}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onMouseMove={handleMouseMove}
                    onDoubleClick={handleDoubleClick}
                    style={{
                        ...animationStyle,
                        opacity: isDragging ? 0.3 : 1
                    }}
                >
                    {!useLoD ? (
                        <>
                            {/* Double-click overlay for website locked mode */}
                            {isWebsiteLocked && (
                                <div
                                    className="hex-website-doubleclick-overlay"
                                    onDoubleClick={handleDoubleClick}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 10,
                                        cursor: 'pointer'
                                    }}
                                    title="Double-click to expand"
                                />
                            )}

                            {/* Website Content */}
                            <div 
                                className="hex-website-content"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // In locked mode, single click expands
                                    if (isWebsiteLocked) {
                                        handleDoubleClick(e);
                                    } else {
                                        // Otherwise, lock to this website first
                                        handleClick(e);
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
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
                                        ref={iframeRef}
                                        src={website.url}
                                        className="hex-website-iframe"
                                        onLoad={handleIframeLoad}
                                        onError={handleIframeError}
                                        title={`Website: ${website.url}`}
                                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                        style={{ 
                                            display: isLoading ? 'none' : 'block',
                                            transform: 'scale(0.5) translate(0px, 0px)'
                                        }}
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
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            {/* Website URL Display with Edit Button */}
                            <div className="hex-website-footer" style={{ position: 'relative', zIndex: 15 }}>
                                <span className="hex-website-url-display">
                                    {website.url.replace(/^https?:\/\//, '').split('/')[0]}
                                </span>
                                <button
                                    onClick={handleEditUrl}
                                    className="hex-website-edit-button"
                                    title="Edit URL"
                                >
                                    <Edit2 className="w-2.5 h-2.5" />
                                </button>
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
            
        </LoDHexWrapper>

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

            {/* Edit URL Modal */}
            <CompactModal
                isOpen={showEditUrl}
                onClose={() => setShowEditUrl(false)}
                type="info"
                confirmText="Save"
                cancelText="Cancel"
                onConfirm={handleSaveUrl}
            >
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ 
                        display: 'block', 
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}>
                        Website URL:
                    </label>
                    <input
                        type="text"
                        value={editingUrl}
                        onChange={(e) => setEditingUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSaveUrl();
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '14px',
                            border: '1px solid rgba(0, 0, 0, 0.2)',
                            borderRadius: '6px',
                            outline: 'none',
                            transition: 'border-color 0.2s ease'
                        }}
                        placeholder="https://example.com"
                        autoFocus
                    />
                </div>
            </CompactModal>
        </>
    );
});

HexWebsite.displayName = 'HexWebsite';

export default HexWebsite;