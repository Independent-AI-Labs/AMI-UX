"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import AnimationManager from './animationManager';
import lodManager from './lodManager';
import tileManager from './tileManager';
import tileGrid, { DataTile, UITile } from './tileSystem';
import { useAppState, useConversationState, useContextMenuState, useInputState } from './hooks/useAppState';
import { useMouseInteraction } from './hooks/useMouseInteraction';
import { useConversationLogic } from './hooks/useConversationLogic';
import { useLockManager } from './hooks/useLockManager';
import Controls from './components/Controls';
import BottomBar from './components/BottomBar';
import Instructions from './components/Instructions';
import HexagonSVG from './components/HexagonSVG';
import VideoBackdrop from './components/VideoBackdrop';
import ErrorToast from './components/ErrorToast';
import StatusBar from './components/StatusBar';
import BlendModeTest from './components/BlendModeTest';
import HexagonalGrid from './components/grid/HexagonalGrid';
import MessageBackdrop from './components/backdrop/MessageBackdrop';
import ModalContainer from './components/modal/ModalContainer';
import DragSystem from './components/drag/DragSystem';
import GridRenderer from './components/GridRenderer';
import { hexSize, hexToPixel, pixelToHex, renderMarkdown } from './utils/hexUtils';
import { initialMessages, initialWebsites } from './data/initialData';

// Import CSS files
import './styles/hexagon.css';
import './styles/message.css';
import './styles/input.css';
import './styles/controls.css';
import './styles/context-menu.css';
import './styles/message-transition.css';
import './styles/video-backdrop.css';
import './styles/error-toast.css';
import './styles/ui-tile-animations.css';
import './styles/status-bar.css';
import './styles/iframe-modal.css';
import './styles/hex-website.css';
import './styles/website-content.css';
import './styles/input-content.css';

const HexagonalMessageGrid = () => {
    // Messages with coordinates and conversation IDs - this is the single source of truth
    const [messages, setMessages] = useState(initialMessages);

    // Websites with coordinates - positioned away from conversation area
    const [websites, setWebsites] = useState(initialWebsites);

    // Store last right-clicked position for context menu actions
    const lastRightClickPosition = useRef({ q: 0, r: 0 });

    // App state management
    const appState = useAppState();
    const conversationState = useConversationState();
    const contextMenuState = useContextMenuState();
    const [showIframeModal, setShowIframeModal] = useState(false);
    const inputState = useInputState();
    
    // UI state (not managed by state machine)
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    // Initialize viewport with default values - will be updated after mount
    const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
    const [startMousePos, setStartMousePos] = useState({ x: 0, y: 0 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [screenCenter, setScreenCenter] = useState({ x: 0, y: 0 });
    const [gridSelection, setGridSelection] = useState({ visible: false, x: 0, y: 0 });
    const [currentHexCoords, setCurrentHexCoords] = useState({ q: 0, r: 0 });
    const [rightClickHexCoords, setRightClickHexCoords] = useState({ q: 0, r: 0 });
    
    // LoD system state
    const [lodState, setLodState] = useState(null);
    
    // Error toast state
    const [errorToast, setErrorToast] = useState({ visible: false, message: '' });
    const [expandingMessage, setExpandingMessage] = useState(null);
    const [expandingWebsite, setExpandingWebsite] = useState(null);
    const [expandingInput, setExpandingInput] = useState(false);
    
    // Video backdrop state
    const [videoInfo, setVideoInfo] = useState(null);
    const [showVideoIndicator, setShowVideoIndicator] = useState(false);
    const videoIndicatorTimeoutRef = useRef(null);
    
    // Track if component has mounted (for SSR)
    const [isMounted, setIsMounted] = useState(false);
    
    // Global drag ghost state
    const [dragGhost, setDragGhost] = useState({ visible: false, website: null });
    
    // Website hover state for external drag handles
    const [websiteHover, setWebsiteHover] = useState({ visible: false, websiteId: null, position: null, onDragStart: null });

    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dragRef = useRef(false);
    const animationManager = useRef(null);

    // Initialize conversation logic
    const conversationLogic = useConversationLogic({
        messages,
        websites,
        conversationState: conversationState,
        screenCenter,
        hexToPixel,
        pixelToHex,
        viewState,
        containerRef,
        animationManager,
        setMessages,
        setErrorToast
    });

    const {
        areColumnsAvailable,
        getAvailableColumnsNearMouse,
        canStartNewChat,
        startNewChat,
        lockToConversation: originalLockToConversation,
        getMessagePosition
    } = conversationLogic;

    // Check if a hex position is occupied (now using tile manager)
    const isHexOccupied = useCallback((q, r) => {
        return tileManager.isTileOccupied(q, r);
    }, []);

    // Get input position for rendering
    const getInputPosition = useCallback(() => {
        const inputTile = Array.from(tileGrid.uiTiles.values()).find(tile => tile.type === 'input');
        if (!inputTile) {
            console.log('No input tile found in tileGrid.uiTiles');
        }
        return inputTile ? inputTile.position : { q: 0, r: 0 };
    }, []);



    // No longer need to generate background hexes - using grid selection instead

    // Initialize animation manager
    useEffect(() => {
        animationManager.current = new AnimationManager(viewState, (newViewState) => {
            setViewState(newViewState);
            // Update LoD system when zoom changes
            lodManager.updateZoom(newViewState.zoom);
        });
        
        // No bounds needed anymore
        
        return () => {
            animationManager.current.stop();
        };
    }, [screenCenter]);
    
    // Initialize LoD system and tile manager
    useEffect(() => {
        
        lodManager.initialize({
            onStateChange: (newState) => {
                setLodState(newState);
                console.log('LoD State Changed:', newState);
            },
            onTransition: (transitionType, data, newState) => {
                console.log('LoD Transition:', transitionType, data, newState);
            }
        });
        
        // Clear and populate tile grid with messages (functional data tiles)
        tileGrid.dataTiles.clear();
        tileGrid.uiTiles.clear();
        tileGrid.positionIndex.clear();
        tileGrid.conversationIndex.clear();
        
        messages.forEach(message => {
            const dataTile = new DataTile(
                message.id,
                'message',
                message,
                { q: message.q, r: message.r }
            );
            tileGrid.addDataTile(dataTile);
            
            // Also update old tile manager for compatibility
            tileManager.occupyTile(message.q, message.r, 'message', message.conversationId);
        });
        
        // Tile grid initialized
        
        return () => {
            // Cleanup if needed
        };
    }, [messages]);

    // Mark component as mounted for SSR
    useEffect(() => {
        setIsMounted(true);
    }, []);
    
    // Initialize lock manager after managers are set up
    const lockManager = useLockManager(animationManager, lodManager, screenCenter, hexToPixel);
    
    // Override lockToConversation to use lock manager
    const lockToConversation = useCallback((q, r, messageId) => {
        // Find the message to get its conversationId
        const message = messages.find(m => m.id === messageId);
        const conversationId = message ? message.conversationId : `conv_${Math.floor(q / 2)}`;
        lockManager.lockToConversation(conversationId, messageId, q, r);
    }, [messages, lockManager]);
    
    // UI Tile Management: Handle input tile display
    useEffect(() => {
        // Remove existing input UI tile
        const existingInput = Array.from(tileGrid.uiTiles.values()).find(tile => tile.type === 'input');
        if (existingInput) {
            console.log('Removing existing input tile:', existingInput.id);
            tileGrid.removeTile(existingInput.id);
        }
        
        // Add input UI tile if conversation is locked
        if (lockManager.isConversationMode && lockManager.lockedTarget) {
            console.log('Adding input tile for conversation:', lockManager.lockedTarget);
            const inputPosition = tileGrid.getNextConversationPosition(lockManager.lockedTarget);
            console.log('Calculated input position:', inputPosition);
            if (inputPosition) {
                const inputTile = new UITile(
                    'input_' + lockManager.lockedTarget,
                    'input',
                    inputPosition,
                    { conversationId: lockManager.lockedTarget }
                );
                tileGrid.addUITile(inputTile);
                console.log('Added input tile:', inputTile);
            } else {
                console.log('No input position calculated!');
            }
        } else {
            console.log('Not in conversation mode or no locked target:', {
                isConversationMode: lockManager.isConversationMode,
                lockedTarget: lockManager.lockedTarget
            });
        }
    }, [lockManager.isConversationMode, lockManager.lockedTarget]);
    
    // Screen center tracking
    useEffect(() => {
        const updateCenter = () => {
            if (typeof window !== 'undefined') {
                const newCenter = {
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                };
                setScreenCenter(newCenter);
                
                // Screen size changed - no bounds to update
            }
        };

        updateCenter();
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateCenter);
            return () => window.removeEventListener('resize', updateCenter);
        }
    }, []);

    // Center everything when component mounts on client
    useEffect(() => {
        // Only run on client after mount
        if (typeof window !== 'undefined' && screenCenter.x > 0 && screenCenter.y > 0) {
            // Calculate grid center in pixels (midpoint of 32x16 grid is at 15.5, 7.5)
            const gridCenterPixels = hexToPixel(15.5, 7.5);
            
            // Offset viewport so grid center appears at screen center
            const offsetX = screenCenter.x - gridCenterPixels.x;
            const offsetY = screenCenter.y - gridCenterPixels.y;
            
            // Only update if not already centered
            setViewState(prev => {
                if (prev.x === 0 && prev.y === 0) {
                    return {
                        ...prev,
                        x: offsetX,
                        y: offsetY
                    };
                }
                return prev;
            });
            
            // Also update animation manager if it exists
            if (animationManager.current && animationManager.current.viewState.x === 0) {
                // Directly set the state without animation for initial positioning
                animationManager.current.viewState = {
                    x: offsetX,
                    y: offsetY,
                    zoom: 1
                };
                animationManager.current.targetPosition = { x: offsetX, y: offsetY };
                animationManager.current.targetZoom = 1;
                animationManager.current.onUpdateCallback({ x: offsetX, y: offsetY, zoom: 1 });
            }
        }
    }, [screenCenter, hexToPixel]);

    // Use unified unlock from lockManager
    const unlockConversation = lockManager.unlock;
    const handleUnlockWebsite = lockManager.unlock;

    // Handle escape key - simplified to always unlock completely
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                lockManager.unlock();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [lockManager]);

    const resetView = () => {
        // Reset to grid center positioned at screen center
        const gridCenterPixels = hexToPixel(15.5, 7.5);
        const centeredViewState = {
            x: screenCenter.x - gridCenterPixels.x,
            y: screenCenter.y - gridCenterPixels.y,
            zoom: 1
        };
        animationManager.current.setViewState(centeredViewState);
        // Clear locked state
        lockManager.unlock();
    };


    // Initialize mouse interaction handlers
    const { handleMouseDown, handleCanvasClick, handleCanvasWheel } = useMouseInteraction({
        conversationState: lockManager,
        dragGhost,
        animationManager,
        unlockConversation: lockManager.unlock,
        setIsDragging,
        setLastMouse,
        setStartMousePos,
        dragRef,
        lockedWebsiteId: lockManager.isWebsiteMode ? lockManager.lockedTarget : null,
        handleUnlockWebsite: lockManager.unlock
    });

    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });

        // Calculate grid selection position using tile manager
        if (typeof window !== 'undefined' && !isDragging && !lockManager.isLocked) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                // Convert screen coordinates to world coordinates in 3D space
                const worldX = (e.clientX - rect.left - viewState.x) / viewState.zoom;
                const worldY = (e.clientY - rect.top - viewState.y) / viewState.zoom;
                
                // Get the tile at this position
                const tile = tileManager.getTileAtPixel(worldX, worldY);
                tileManager.setHoveredTile(tile.q, tile.r);
                
                // Update current hex coords for compatibility
                setCurrentHexCoords({ q: tile.q, r: tile.r });
                
                // Check if this tile is available and within rectangular grid bounds
                const gridCols = 32;
                const gridRows = 16;
                
                if (tile.q >= 0 && tile.q < gridCols && tile.r >= 0 && tile.r < gridRows && !tile.occupied) {
                    setGridSelection({
                        visible: true,
                        x: tile.x,
                        y: tile.y
                    });
                } else {
                    setGridSelection(prev => ({ ...prev, visible: false }));
                }
            }
        } else {
            setGridSelection(prev => ({ ...prev, visible: false }));
        }

        if (!isDragging) return;

        const deltaX = e.clientX - lastMouse.x;
        const deltaY = e.clientY - lastMouse.y;

        // Only mark as drag if actively dragging AND moved significantly
        if (isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
            dragRef.current = true;
        }

        if (lockManager.isLocked) {
            animationManager.current.updatePosition(0, deltaY);
            animationManager.current.setInitialVelocity(0, deltaY * 0.3);
        } else {
            animationManager.current.updatePosition(deltaX, deltaY);
            animationManager.current.setInitialVelocity(deltaX * 0.3, deltaY * 0.3);
        }

        setLastMouse({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = (e) => {
        setIsDragging(false);
        // CRITICAL: Reset dragRef so tiles can be clicked again
        dragRef.current = false;
    };

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        
        // Get the tile at right-click location using tile manager
        const rect = containerRef.current?.getBoundingClientRect();
        let worldX = 0, worldY = 0, tile = { q: 0, r: 0 };
        
        if (rect) {
            // Convert mouse coordinates in 3D space
            worldX = (e.clientX - rect.left - viewState.x) / viewState.zoom;
            worldY = (e.clientY - rect.top - viewState.y) / viewState.zoom;
            
            tile = tileManager.getTileAtPixel(worldX, worldY);
            console.log('Context menu - world coords:', { worldX, worldY });
            console.log('Context menu - tile from tileManager:', tile);
            
            // Store the position for later use
            lastRightClickPosition.current = { q: tile.q, r: tile.r };
            
            tileManager.setRightClickedTile(tile.q, tile.r);
        }
        
        contextMenuState.open(
            { 
                x: e.clientX, 
                y: e.clientY,
                worldX: worldX,
                worldY: worldY,
                hexQ: tile.q,
                hexR: tile.r
            },
            { canStartNewChat: canStartNewChat }
        );
    }, [viewState, contextMenuState, canStartNewChat]);

    const handleCloseContextMenu = useCallback(() => {
        contextMenuState.close();
    }, [contextMenuState]);

    const handleOpenIframeModal = useCallback(() => {
        setShowIframeModal(true);
    }, []);

    const handleCloseIframeModal = useCallback(() => {
        setShowIframeModal(false);
    }, []);

    const handleCreateWebsite = useCallback((url) => {
        // Find next available position near the clicked position
        const findNextAvailablePosition = () => {
            const occupiedPositions = new Set([
                ...messages.map(m => `${m.q},${m.r}`),
                ...websites.map(w => `${w.q},${w.r}`)
            ]);
            
            // Use hex coordinates from last right-click position
            let baseQ = lastRightClickPosition.current.q;
            let baseR = lastRightClickPosition.current.r;
            console.log('Using stored right-click position:', { baseQ, baseR });
            
            // Try nearby positions in a spiral pattern
            for (let radius = 0; radius < 10; radius++) {
                for (let i = 0; i < (radius === 0 ? 1 : 6 * radius); i++) {
                    let q, r;
                    if (radius === 0) {
                        q = baseQ;
                        r = baseR;
                    } else {
                        // Hexagonal spiral
                        const angle = (i / (6 * radius)) * 2 * Math.PI;
                        q = baseQ + Math.round(radius * Math.cos(angle));
                        r = baseR + Math.round(radius * Math.sin(angle));
                    }
                    
                    if (!occupiedPositions.has(`${q},${r}`)) {
                        return { q, r };
                    }
                }
            }
            
            return { q: 0, r: 0 }; // Fallback
        };

        const position = findNextAvailablePosition();
        console.log('Final position chosen for website:', position);
        const newWebsite = {
            id: Date.now(),
            url: url,
            timestamp: new Date(),
            ...position
        };
        console.log('New website object:', newWebsite);

        setWebsites(prev => [...prev, newWebsite]);
        setShowIframeModal(false);
    }, [messages, websites]);

    const handleRemoveWebsite = useCallback((websiteId) => {
        setWebsites(prev => prev.filter(w => w.id !== websiteId));
    }, []);

    const handleUpdateWebsiteUrl = useCallback((websiteId, newUrl) => {
        setWebsites(prev => prev.map(w => 
            w.id === websiteId ? { ...w, url: newUrl } : w
        ));
    }, []);

    const handleMoveWebsite = useCallback((websiteId, newQ, newR) => {
        // Check if the target position is free
        const occupiedPositions = new Set([
            ...messages.map(m => `${m.q},${m.r}`),
            ...websites.filter(w => w.id !== websiteId).map(w => `${w.q},${w.r}`)
        ]);
        
        if (!occupiedPositions.has(`${newQ},${newR}`)) {
            setWebsites(prev => prev.map(w => 
                w.id === websiteId ? { ...w, q: newQ, r: newR } : w
            ));
            console.log(`Moved website ${websiteId} to position (${newQ}, ${newR})`);
        } else {
            console.log(`Position (${newQ}, ${newR}) is occupied, cannot move website`);
        }
    }, [messages, websites]);

    const handleHideErrorToast = useCallback(() => {
        setErrorToast(prev => ({ ...prev, visible: false }));
    }, []);

    const handleExpandMessage = useCallback((messageId, q, r) => {
        console.log(`Expanding message ${messageId} to full viewport`);
        
        // Find the message
        const message = messages.find(m => m.id === messageId);
        if (!message) return;
        
        // Start expanding animation
        setExpandingMessage({ message });
    }, [messages]);

    const handleCloseExpanded = useCallback(() => {
        console.log('Closing expanded view');
        setExpandingMessage(null);
        setExpandingWebsite(null);
        setExpandingInput(false);
    }, []);

    const handleExpandWebsite = useCallback((websiteId, q, r) => {
        console.log(`Expanding website ${websiteId} to full viewport`);
        
        // Find the website
        const website = websites.find(w => w.id === websiteId);
        if (!website) return;
        
        // Start expanding animation
        setExpandingWebsite({ website });
    }, [websites]);


    const handleExpandInput = useCallback(() => {
        console.log('Expanding input to full viewport');
        setExpandingInput(true);
    }, []);

    const handleLockToWebsite = useCallback((websiteId, q, r) => {
        lockManager.lockToWebsite(websiteId, q, r);
    }, [lockManager]);

    // Track mouse position for drag silhouette
    useEffect(() => {
        const handleMouseMove = (e) => {
            document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
            document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        };

        document.addEventListener('mousemove', handleMouseMove);
        return () => document.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Hide drag handle on any click, mousedown, or scroll
    useEffect(() => {
        const hideDragHandle = () => {
            if (websiteHover.visible) {
                setWebsiteHover({ visible: false, websiteId: null, position: null, onDragStart: null });
            }
        };

        document.addEventListener('click', hideDragHandle);
        document.addEventListener('mousedown', hideDragHandle);
        document.addEventListener('wheel', hideDragHandle);
        document.addEventListener('scroll', hideDragHandle, true); // Capture phase for all scrolls

        return () => {
            document.removeEventListener('click', hideDragHandle);
            document.removeEventListener('mousedown', hideDragHandle);
            document.removeEventListener('wheel', hideDragHandle);
            document.removeEventListener('scroll', hideDragHandle, true);
        };
    }, [websiteHover.visible]);


    // Add wheel event listener at window level to catch all wheel events
    useEffect(() => {
        const handleWheelEvent = (e) => {
            // Check if wheel is over our app (not some other overlay or modal)
            const container = containerRef.current;
            if (!container) return;
            
            const rect = container.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || 
                e.clientY < rect.top || e.clientY > rect.bottom) {
                return; // Wheel event outside our app
            }

            e.preventDefault();

            if (lockManager.isLocked) {
                const deltaY = e.deltaY * 2;
                animationManager.current.updatePosition(0, -deltaY);
            } else {
                const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
                const newZoom = Math.max(0.2, Math.min(3.0, viewState.zoom * zoomFactor));
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                animationManager.current.setZoom(newZoom, mouseX, mouseY, screenCenter);
            }
        };

        window.addEventListener('wheel', handleWheelEvent, { passive: false });
        return () => window.removeEventListener('wheel', handleWheelEvent);
    }, [lockManager.isLocked, viewState.zoom, screenCenter]);



    const handleSend = () => {
        if (!inputText.trim()) return;

        const newMessage = {
            id: Date.now(),
            text: inputText,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);
        setInputText('');

        if (inputRef.current) {
            inputRef.current.innerHTML = '';
        }

        setIsTyping(true);

        setTimeout(() => {
            const aiResponse = {
                id: Date.now() + 1,
                text: "**Great question!** Let me elaborate on that topic with some detailed insights:\n\n**Key Points:**\n• Advanced implementation strategies\n• Real-world performance metrics\n• Future development roadmaps\n\nThis represents the *current state* of the field with promising developments ahead.",
                sender: "ai",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiResponse]);
            setIsTyping(false);
        }, 2200);
    };

    const handleCopyMessage = useCallback((text) => {
        navigator.clipboard.writeText(text);
    }, []);
    
    const renderMarkdownMemo = useCallback((text) => {
        return renderMarkdown(text);
    }, []);
    
    // Handle video backdrop changes
    const handleVideoChange = useCallback((info) => {
        setVideoInfo(info);
        
        // Show indicator if manual change
        if (info.isManual) {
            setShowVideoIndicator(true);
            if (videoIndicatorTimeoutRef.current) {
                clearTimeout(videoIndicatorTimeoutRef.current);
            }
            videoIndicatorTimeoutRef.current = setTimeout(() => {
                setShowVideoIndicator(false);
            }, 3000);
        }
    }, []);

    // No longer need backgroundHexes

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Status Bar */}
            <StatusBar hasActiveToast={errorToast.visible} />
            
            {/* 3D Background Container - Videos ONLY with parallax */}
            <div 
                style={{
                    position: 'absolute',
                    inset: 0,
                    perspective: '1000px',
                    perspectiveOrigin: '50% 50%',
                    transformStyle: 'preserve-3d',
                    overflow: 'visible',
                    pointerEvents: 'none'
                }}
            >
                {/* Transform for video backgrounds - minimal zoom effect */}
                <div
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        transform: isMounted 
                            ? `translateX(${viewState.x * 0.3}px) translateY(${viewState.y * 0.3}px) scale(${0.35 + (viewState.zoom - 1) * 0.08})`
                            : 'translateX(0px) translateY(0px) scale(0.35)',
                        transformOrigin: '0 0',
                        transformStyle: 'preserve-3d',
                        willChange: 'transform',
                        overflow: 'visible'
                    }}
                >
                    {/* Video Backdrop with 3D parallax */}
                    <VideoBackdrop 
                        viewState={viewState}
                        screenCenter={screenCenter}
                        onVideoChange={handleVideoChange}
                    />
                </div>
            </div>
            
            {/* Dim overlay for pan interaction - covers viewport */}
            <div
                ref={containerRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ 
                    background: 'rgba(0, 0, 0, 0.25)',
                    pointerEvents: 'auto',
                    zIndex: 9 // Just below content layer
                }} 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={handleContextMenu}
                onClick={handleCanvasClick}
                onWheel={handleCanvasWheel}
            />
            
            {/* Main Interactive Grid Canvas Layer - All grid elements together */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    transform: isMounted
                        ? `translateX(${viewState.x}px) translateY(${viewState.y}px) scale(${viewState.zoom})`
                        : 'translateX(0px) translateY(0px) scale(1)',
                    transformOrigin: '0 0',
                    willChange: 'transform',
                    pointerEvents: 'none', // Let events pass through to container
                    zIndex: 10
                }}
            >
                <BlendModeTest />
                <HexagonSVG />
                <GridRenderer viewState={viewState} />
                <MessageBackdrop
                    messages={messages}
                    viewState={viewState}
                    hexSize={hexSize}
                    hexToPixel={hexToPixel}
                    getMessagePosition={getMessagePosition}
                    showInput={lockManager.isConversationMode && !isTyping}
                    inputPosition={lockManager.isConversationMode && !isTyping ? getInputPosition() : null}
                />
                <HexagonalGrid
                    messages={messages}
                    websites={websites}
                    isTyping={isTyping}
                    viewState={viewState}
                    hexSize={hexSize}
                    gridSelection={gridSelection}
                    conversationState={lockManager}
                    inputState={inputState}
                    lockedWebsiteId={lockManager.isWebsiteMode ? lockManager.lockedTarget : null}
                    dragRef={dragRef}
                    dragGhost={dragGhost}
                    websiteHover={websiteHover}
                    lodState={lodState}
                    hexToPixel={hexToPixel}
                    pixelToHex={pixelToHex}
                    getInputPosition={getInputPosition}
                    getMessagePosition={getMessagePosition}
                    lockToConversation={lockToConversation}
                    handleExpandMessage={handleExpandMessage}
                    handleCloseExpanded={handleCloseExpanded}
                    handleCopyMessage={handleCopyMessage}
                    renderMarkdownMemo={renderMarkdownMemo}
                    handleLockToWebsite={handleLockToWebsite}
                    handleRemoveWebsite={handleRemoveWebsite}
                    handleUpdateWebsiteUrl={handleUpdateWebsiteUrl}
                    handleMoveWebsite={handleMoveWebsite}
                    handleExpandWebsite={handleExpandWebsite}
                    setDragGhost={setDragGhost}
                    setWebsiteHover={setWebsiteHover}
                    containerRef={containerRef}
                    inputRef={inputRef}
                    inputText={inputText}
                    setInputText={setInputText}
                    handleSend={handleSend}
                    handleExpandInput={handleExpandInput}
                />
            </div>

            <BottomBar
                isLocked={lockManager.isLocked}
                isWebsiteLocked={lockManager.isWebsiteMode}
            />

            <Controls
                isLocked={lockManager.isConversationMode}
                isWebsiteLocked={lockManager.isWebsiteMode}
                viewState={viewState}
                screenCenter={screenCenter}
                animationManager={animationManager}
                onExitLocked={unlockConversation}
                onExitWebsiteLocked={handleUnlockWebsite}
                onResetView={resetView}
            />

            <Instructions isLocked={lockManager.isLocked} />
            
            {/* Video Indicator - Non-scalable UI */}
            {showVideoIndicator && videoInfo && (
                <div style={{
                    position: 'fixed',
                    bottom: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backdropFilter: 'blur(10px)',
                    transition: 'opacity 0.3s ease-out',
                    opacity: showVideoIndicator ? 1 : 0
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {Array.from({ length: videoInfo.totalVideos }, (_, index) => (
                            <div
                                key={index}
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: index === videoInfo.currentIndex ? '#fff' : 'rgba(255, 255, 255, 0.3)',
                                    transition: 'all 0.3s ease-out'
                                }}
                            />
                        ))}
                    </div>
                    <span>{videoInfo.videoInfo.name}</span>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>Shift + ← →</span>
                </div>
            )}
            
            {/* Error Toast */}
            <ErrorToast
                message={errorToast.message}
                visible={errorToast.visible}
                onHide={handleHideErrorToast}
            />
            
            {/* Modals and Context Menus */}
            <ModalContainer
                contextMenuState={contextMenuState}
                showIframeModal={showIframeModal}
                expandingMessage={expandingMessage}
                expandingWebsite={expandingWebsite}
                expandingInput={expandingInput}
                canStartNewChat={canStartNewChat}
                inputText={inputText}
                setInputText={setInputText}
                handleCloseContextMenu={handleCloseContextMenu}
                startNewChat={startNewChat}
                handleOpenIframeModal={handleOpenIframeModal}
                handleCloseIframeModal={handleCloseIframeModal}
                handleCreateWebsite={handleCreateWebsite}
                handleCloseExpanded={handleCloseExpanded}
                handleRemoveWebsite={handleRemoveWebsite}
                handleSend={handleSend}
                renderMarkdown={renderMarkdown}
            />
            
            {/* Drag System */}
            <DragSystem
                dragGhost={dragGhost}
                websiteHover={websiteHover}
                hexSize={hexSize}
            />
        </div>
    );
};

export default HexagonalMessageGrid;