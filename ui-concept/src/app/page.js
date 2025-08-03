"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import AnimationManager from './animationManager';
import lodManager from './lodManager';
import tileManager from './tileManager';
import tileGrid, { DataTile, UITile } from './tileSystem';
import { useAppState, useConversationState, useContextMenuState, useInputState } from './hooks/useAppState';
import { useMouseInteraction } from './hooks/useMouseInteraction';
import { useConversationLogic } from './hooks/useConversationLogic';
import Controls from './components/Controls';
import ZoomSlider from './components/ZoomSlider';
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
import GridDots from './components/GridDots';
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
    const [lockedWebsiteId, setLockedWebsiteId] = useState(null);
    
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
        conversationState,
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
        lockToConversation,
        getMessagePosition
    } = conversationLogic;

    // Check if a hex position is occupied (now using tile manager)
    const isHexOccupied = useCallback((q, r) => {
        return tileManager.isTileOccupied(q, r);
    }, []);

    // UI Tile Management: Handle input tile display
    useEffect(() => {
        // Remove existing input UI tile
        const existingInput = Array.from(tileGrid.uiTiles.values()).find(tile => tile.type === 'input');
        if (existingInput) {
            tileGrid.removeTile(existingInput.id);
        }
        
        // Add input UI tile if conversation is locked
        if (conversationState.isLocked && conversationState.conversationId) {
            const inputPosition = tileGrid.getNextConversationPosition(conversationState.conversationId);
            if (inputPosition) {
                const inputTile = new UITile(
                    'input_' + conversationState.conversationId,
                    'input',
                    inputPosition,
                    { conversationId: conversationState.conversationId }
                );
                tileGrid.addUITile(inputTile);
            }
        }
    }, [conversationState.isLocked, conversationState.conversationId]);

    // Get input position for rendering
    const getInputPosition = useCallback(() => {
        const inputTile = Array.from(tileGrid.uiTiles.values()).find(tile => tile.type === 'input');
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
        
        // Initialize bounds with screen center once available
        if (screenCenter) {
            animationManager.current.updateBounds(screenCenter);
        }
        
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

    // Screen center tracking
    useEffect(() => {
        const updateCenter = () => {
            if (typeof window !== 'undefined') {
                const newCenter = {
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                };
                setScreenCenter(newCenter);
                
                // Update animation manager bounds when screen size changes
                if (animationManager.current) {
                    animationManager.current.updateBounds(newCenter);
                }
            }
        };

        updateCenter();
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateCenter);
            return () => window.removeEventListener('resize', updateCenter);
        }
    }, []);

    // Center the grid when screenCenter is first calculated
    useEffect(() => {
        if (screenCenter.x > 0 && screenCenter.y > 0 && viewState.x === 0 && viewState.y === 0) {
            // Center the grid by placing the origin (0,0) hex at screen center
            setViewState(prev => ({
                ...prev,
                x: screenCenter.x,
                y: screenCenter.y
            }));
            
            // Also update animation manager if it exists
            if (animationManager.current) {
                animationManager.current.setViewState({
                    x: screenCenter.x,
                    y: screenCenter.y,
                    zoom: 1
                });
            }
        }
    }, [screenCenter]);

    // Centralized unlock function - force clear all states
    const unlockConversation = useCallback(() => {
        // Force unlock all systems to prevent stuck states
        try {
            // 1. Force unlock conversation state
            if (conversationState && typeof conversationState.unlock === 'function') {
                conversationState.unlock();
            }
            
            // 2. Force clear LoD manager
            lodManager.unlock();
            lodManager.returnToWorkspace();
            
            // 3. Force clear animation manager
            if (animationManager.current) {
                animationManager.current.setLocked(false);
            }
            
            // 4. Force reset view to workspace if needed
            const currentState = lodManager.getCurrentState();
            if (currentState.context.level !== 'workspace') {
                lodManager.returnToWorkspace();
            }
        } catch (error) {
            console.error('Error during unlock, forcing reset:', error);
            // If anything fails, force reset everything
            lodManager.returnToWorkspace();
        }
    }, [conversationState]);

    // Website unlock function
    const handleUnlockWebsite = useCallback(() => {
        console.log('Unlocking website');
        setLockedWebsiteId(null);
    }, []);

    // Handle escape key - simplified to always unlock completely
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                // Always force complete unlock to prevent stuck states
                if (lockedWebsiteId) {
                    handleUnlockWebsite();
                } else {
                    unlockConversation();
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [unlockConversation, lockedWebsiteId, handleUnlockWebsite]);

    const resetView = () => {
        // Reset to centered position instead of (0,0)
        const centeredViewState = {
            x: screenCenter.x,
            y: screenCenter.y,
            zoom: 1
        };
        animationManager.current.setViewState(centeredViewState);
        // Clear locked conversation with error handling
        try {
            if (conversationState && typeof conversationState.unlock === 'function') {
                conversationState.unlock();
            }
        } catch (error) {
            console.error('Error during unlock in resetView:', error);
        }
    };


    // Initialize mouse interaction handlers
    const { handleMouseDown, handleCanvasClick, handleCanvasWheel } = useMouseInteraction({
        conversationState,
        dragGhost,
        animationManager,
        unlockConversation,
        setIsDragging,
        setLastMouse,
        setStartMousePos,
        dragRef,
        lockedWebsiteId,
        handleUnlockWebsite
    });

    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });

        // Calculate grid selection position using tile manager
        if (typeof window !== 'undefined' && !isDragging && !conversationState.isLocked) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                // Convert screen coordinates to world coordinates
                const worldX = (e.clientX - rect.left - viewState.x) / viewState.zoom;
                const worldY = (e.clientY - rect.top - viewState.y) / viewState.zoom;
                
                // Get the tile at this position
                const tile = tileManager.getTileAtPixel(worldX, worldY);
                tileManager.setHoveredTile(tile.q, tile.r);
                
                // Update current hex coords for compatibility
                setCurrentHexCoords({ q: tile.q, r: tile.r });
                
                // Check if this tile is available and within reasonable bounds
                const maxRadius = 12;
                const distance = Math.sqrt(tile.q * tile.q + tile.r * tile.r);
                
                if (distance <= maxRadius && !tile.occupied) {
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

        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            dragRef.current = true;
        }

        if (conversationState.isLocked) {
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
    };

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        
        // Get the tile at right-click location using tile manager
        const rect = containerRef.current?.getBoundingClientRect();
        let worldX = 0, worldY = 0, tile = { q: 0, r: 0 };
        
        if (rect) {
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
        console.log(`Locking to website ${websiteId} at (${q}, ${r})`);
        setLockedWebsiteId(websiteId);
        
        // Get the pixel position of the website tile
        const tileCenter = hexToPixel(q, r);
        const zoom = 1.8;
        
        // Calculate view position to center this tile (same formula as conversation locking)
        const newX = screenCenter.x - (tileCenter.x * zoom);
        const newY = screenCenter.y - (tileCenter.y * zoom);
        
        animationManager.current.setViewState({
            x: newX,
            y: newY,
            zoom: zoom
        });
    }, [screenCenter, hexToPixel]);

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


    // Add wheel event listener with passive: false to allow preventDefault
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheelEvent = (e) => {
            e.preventDefault();

            if (conversationState.isLocked) {
                const deltaY = e.deltaY * 2;
                animationManager.current.updatePosition(0, -deltaY);
            } else {
                const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
                const newZoom = Math.max(0.2, Math.min(3.0, viewState.zoom * zoomFactor));
                const mouseX = mousePos.x;
                const mouseY = mousePos.y;
                animationManager.current.setZoom(newZoom, mouseX, mouseY, screenCenter);
            }
        };

        container.addEventListener('wheel', handleWheelEvent, { passive: false });
        return () => container.removeEventListener('wheel', handleWheelEvent);
    }, [conversationState.isLocked, viewState.zoom, mousePos.x, mousePos.y, screenCenter]);


    const handleZoomSlider = (e) => {
        const newZoom = parseFloat(e.target.value);
        const centerX = screenCenter.x;
        const centerY = screenCenter.y;
        animationManager.current.setZoom(newZoom, centerX, centerY, screenCenter);
    };

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

    // No longer need backgroundHexes

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Status Bar */}
            <StatusBar hasActiveToast={errorToast.visible} />
            
            {/* Video Backdrop with Parallax */}
            <VideoBackdrop 
                viewState={viewState}
                screenCenter={screenCenter}
            />

            {/* Blend Mode Test Hex */}
            <BlendModeTest />
            
            <HexagonSVG />
            
            {/* Grid dots - small white dots at tile centers */}
            <GridDots
                viewState={viewState}
                screenCenter={screenCenter}
                hexToPixel={hexToPixel}
                hexSize={hexSize}
            />
            
            <ZoomSlider
                viewState={viewState}
                onZoomSliderChange={handleZoomSlider}
            />

            <Controls
                isLocked={conversationState.isLocked}
                isWebsiteLocked={!!lockedWebsiteId}
                viewState={viewState}
                screenCenter={screenCenter}
                animationManager={animationManager}
                onExitLocked={unlockConversation}
                onExitWebsiteLocked={handleUnlockWebsite}
                onResetView={resetView}
            />

            {/* Backdrop layer - completely separate from canvas */}
            <MessageBackdrop
                messages={messages}
                viewState={viewState}
                hexSize={hexSize}
                hexToPixel={hexToPixel}
                getMessagePosition={getMessagePosition}
            />

            {/* Canvas Container */}
            <div
                ref={containerRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ zIndex: 20 }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={handleContextMenu}
                onClick={handleCanvasClick}
                onWheel={handleCanvasWheel}
            >
                {/* Hexagonal Grid */}
                <HexagonalGrid
                    messages={messages}
                    websites={websites}
                    isTyping={isTyping}
                    viewState={viewState}
                    hexSize={hexSize}
                    gridSelection={gridSelection}
                    conversationState={conversationState}
                    inputState={inputState}
                    lockedWebsiteId={lockedWebsiteId}
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

            <Instructions isLocked={conversationState.isLocked} />
            
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