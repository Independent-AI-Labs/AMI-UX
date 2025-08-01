"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import AnimationManager from './animationManager';
import lodManager, { CONTEXT_LEVELS } from './lodManager';
import tileManager from './tileManager';
import tileGrid, { DataTile, UITile } from './tileSystem';
import { useAppState, useConversationState, useContextMenuState, useInputState } from './hooks/useAppState';
import { StateActions } from './appStateManager';
import HexMessage from './components/HexMessage';
import HexInput from './components/HexInput';
import HexBackground from './components/HexBackground';
import TypingIndicator from './components/TypingIndicator';
import Controls from './components/Controls';
import ZoomSlider from './components/ZoomSlider';
import Instructions from './components/Instructions';
import HexagonSVG from './components/HexagonSVG';
import GridSelection from './components/GridSelection';
import ContextMenu from './components/ContextMenu';
import VideoBackdrop from './components/VideoBackdrop';
import ErrorToast from './components/ErrorToast';
import AnimatedUITile from './components/AnimatedUITile';
import StatusBar from './components/StatusBar';

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

const HexagonalMessageGrid = () => {
    // Messages with coordinates and conversation IDs - this is the single source of truth
    const [messages, setMessages] = useState([
        {
            id: 1,
            conversationId: "conv_1",
            text: "**Neural interface initialized.** \n\n*System status: Online*\n\nHow may I assist you with your quantum computing research today?",
            sender: "ai",
            timestamp: new Date(Date.now() - 600000),
            q: 0,
            r: 0
        },
        {
            id: 2,
            conversationId: "conv_1", 
            text: "I need help understanding **quantum entanglement protocols** for secure communication systems. Can you explain the key implementation strategies?",
            sender: 'user',
            timestamp: new Date(Date.now() - 580000),
            q: 1,
            r: 0
        },
        {
            id: 3,
            conversationId: "conv_1",
            text: "Quantum entanglement protocols involve creating **correlated quantum states** between particles separated by arbitrary distances.\n\n**Key implementations include:**\n• Bell state measurement\n• Quantum teleportation sequences\n• Distributed quantum key generation\n\nThese enable *provably secure* communication channels through quantum mechanical properties.",
            sender: "ai",
            timestamp: new Date(Date.now() - 560000),
            q: 0,
            r: 1
        },
        {
            id: 4,
            conversationId: "conv_1",
            text: "That's fascinating! How do we handle **quantum decoherence** in practical implementations? I'm particularly interested in error correction methods.",
            sender: 'user',
            timestamp: new Date(Date.now() - 540000),
            q: 1,
            r: 1
        },
        {
            id: 5,
            conversationId: "conv_1",
            text: "**Quantum Error Correction (QEC)** is crucial for practical systems:\n\n**Surface Codes:**\n• Use 2D lattice of qubits\n• Detect both bit-flip and phase-flip errors\n• Threshold ~1% error rate\n\n**Stabilizer Codes:**\n• Encode logical qubits in physical qubit states\n• Enable fault-tolerant operations\n• Examples: Shor code, Steane code\n\n*Decoherence times* typically range from microseconds to milliseconds depending on the physical implementation.",
            sender: "ai",
            timestamp: new Date(Date.now() - 520000),
            q: 0,
            r: 2
        },
        {
            id: 6,
            conversationId: "conv_1",
            text: "What about **scalability challenges**? How do current quantum systems compare to classical distributed systems in terms of network topology and latency?",
            sender: 'user',
            timestamp: new Date(Date.now() - 500000),
            q: 1,
            r: 2
        },
        {
            id: 7,
            conversationId: "conv_1",
            text: "**Scalability remains a major challenge:**\n\n**Current Limitations:**\n• Limited qubit counts (100-1000 range)\n• High error rates (~0.1-1%)\n• Short coherence times\n\n**Network Topology:**\n• *Star configurations* for small networks\n• *Linear chains* for quantum repeaters\n• *Mesh topologies* for fault tolerance\n\n**Latency Comparison:**\n• Classical: ~1-100ms global\n• Quantum: Limited by light speed + processing\n• Quantum repeaters add ~10-100ms per hop\n\nThe **quantum internet** will likely use hybrid classical-quantum protocols for optimal performance.",
            sender: "ai",
            timestamp: new Date(Date.now() - 480000),
            q: 0,
            r: 3
        },
        {
            id: 8,
            conversationId: "conv_1",
            text: "Interesting! Can you provide some **concrete examples** of companies or research institutions that are successfully implementing these quantum communication protocols at scale?",
            sender: 'user',
            timestamp: new Date(Date.now() - 460000),
            q: 1,
            r: 3
        },
        {
            id: 9,
            conversationId: "conv_1",
            text: "**Leading Quantum Communication Implementations:**\n\n**Commercial Deployments:**\n• **ID Quantique** - Quantum key distribution networks in Geneva and Vienna\n• **Toshiba** - QKD links in UK and Japan (100+ km fiber)\n• **QuantumCTek** - Chinese quantum communication backbone\n\n**Research Institutions:**\n• **MIT Lincoln Lab** - Quantum internet testbed\n• **Delft University** - Quantum network node experiments\n• **University of Vienna** - Long-distance quantum teleportation\n\n**Recent Milestones:**\n• China's *Micius satellite* - 1200km quantum communication\n• European Quantum Internet Alliance - Multi-node networks\n• IBM Q Network - 20+ quantum computers accessible globally\nMost systems currently operate at **kilobit/second** rates with plans to reach megabit speeds by 2030.",
            sender: "ai",
            timestamp: new Date(Date.now() - 440000),
            q: 0,
            r: 4
        }
    ]);

    // App state management
    const appState = useAppState();
    const conversationState = useConversationState();
    const contextMenuState = useContextMenuState();
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

    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dragRef = useRef(false);
    const animationManager = useRef(null);

    // Hexagon math utilities (using tile manager)
    const hexSize = 180;

    const hexToPixel = (q, r) => {
        return tileManager.hexToPixel(q, r);
    };

    const pixelToHex = (x, y) => {
        return tileManager.pixelToHex(x, y);
    };

    // Simple helper: Get occupied columns from messages
    const getOccupiedColumns = useCallback(() => {
        const occupiedColumns = new Set();
        messages.forEach(msg => {
            const conversationStartQ = Math.floor(msg.q / 2) * 2;
            occupiedColumns.add(conversationStartQ);
        });
        return occupiedColumns;
    }, [messages]);

    // Simple helper: Check if columns are available for new conversation
    const areColumnsAvailable = useCallback((q) => {
        return tileGrid.isColumnPairAvailable(q);
    }, []);

    // Simple helper: Get message position (all messages already have coordinates)
    const getMessagePosition = (message) => {
        return { q: message.q, r: message.r };
    };


    // Pixel to hex conversion now handled by tile manager

    // Check if a hex position is occupied (now using tile manager)
    const isHexOccupied = useCallback((q, r) => {
        return tileManager.isTileOccupied(q, r);
    }, []);

    // Find available column pair near mouse position
    const getAvailableColumnsNearMouse = useCallback((mouseX, mouseY) => {
        const usedPositions = new Set();
        messages.forEach((message, index) => {
            const pos = getMessagePosition(message, index);
            if (pos) {
                usedPositions.add(`${pos.q},${pos.r}`);
            }
        });

        // Convert screen coordinates to container-relative coordinates (same as startNewChat)
        const rect = containerRef.current?.getBoundingClientRect();
        let containerX = mouseX;
        let containerY = mouseY;
        
        if (rect) {
            containerX = mouseX - rect.left;
            containerY = mouseY - rect.top;
        }
        
        // Convert container position to world coordinates
        const worldX = (containerX - viewState.x) / viewState.zoom;
        const worldY = (containerY - viewState.y) / viewState.zoom;
        
        // Convert to hex coordinates
        const mouseHex = pixelToHex(worldX, worldY);
        
        // Find the nearest even column (conversations start on even columns)
        const nearestEvenQ = Math.round(mouseHex.q / 2) * 2;
        
        // Check columns starting from the nearest even column, then expanding outward
        const columnsToCheck = [nearestEvenQ];
        for (let offset = 2; offset <= 20; offset += 2) {
            columnsToCheck.push(nearestEvenQ + offset);
            if (nearestEvenQ - offset >= 0) {
                columnsToCheck.push(nearestEvenQ - offset);
            }
        }

        for (const startQ of columnsToCheck) {
            if (startQ < 0) continue;
            
            let hasSpace = true;
            // Check if this column pair has enough space (at least 12 rows)
            for (let row = 0; row < 12; row++) {
                const leftPos = `${startQ},${row}`;
                const rightPos = `${startQ + 1},${row}`;
                if (usedPositions.has(leftPos) || usedPositions.has(rightPos)) {
                    hasSpace = false;
                    break;
                }
            }
            if (hasSpace) {
                return startQ;
            }
        }
        return null;
    }, [messages, viewState, pixelToHex]);

    const canStartNewChat = useMemo(() => {
        // Use a default position for checking availability
        return getAvailableColumnsNearMouse(screenCenter.x, screenCenter.y) !== null;
    }, [getAvailableColumnsNearMouse, screenCenter]);

    // Check if two adjacent columns are completely free and don't overlap with existing conversations
    const areColumnsEntirelyFree = useCallback((q1, q2) => {
        // First check if individual tiles are occupied
        for (let r = 0; r < 20; r++) {
            if (tileManager.isTileOccupied(q1, r) || tileManager.isTileOccupied(q2, r)) {
                return false;
            }
        }
        
        // Then check if these columns would overlap with existing conversation territories
        // Conversations span 2 columns: even Q and Q+1
        const existingConversations = new Set();
        
        messages.forEach((message, index) => {
            let messageQ;
            if (message.q !== undefined) {
                messageQ = message.q;
            } else {
                const pos = getMessagePosition(message, index);
                messageQ = pos ? pos.q : 0;
            }
            
            // Find the conversation territory (even Q start)
            const convStartQ = Math.floor(messageQ / 2) * 2;
            existingConversations.add(`${convStartQ}-${convStartQ + 1}`);
        });
        
        // Check if our target columns would overlap any existing conversation territory
        const targetTerritory = `${Math.floor(q1 / 2) * 2}-${Math.floor(q1 / 2) * 2 + 1}`;
        
        for (const existingTerritory of existingConversations) {
            const [existingStart, existingEnd] = existingTerritory.split('-').map(Number);
            const [targetStart, targetEnd] = targetTerritory.split('-').map(Number);
            
            // Check for any overlap between territories
            if (targetStart <= existingEnd && targetEnd >= existingStart) {
                console.log(`Territory overlap detected: target ${targetTerritory} overlaps with existing ${existingTerritory}`);
                return false;
            }
        }
        
        return true;
    }, [messages]);

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

    const startNewChat = useCallback(() => {
        // Get the right-clicked tile from tile manager
        const rightClickedTile = tileManager.getRightClickedTile();
        
        if (!rightClickedTile) {
            console.warn('No right-clicked tile found');
            return;
        }
        
        const clickedQ = rightClickedTile.q;
        const clickedR = rightClickedTile.r;
        
        // Check if columns are available
        if (!areColumnsAvailable(clickedQ)) {
            setErrorToast({
                visible: true,
                message: `Territory occupied. Cannot establish conversation at (${clickedQ}, ${clickedR}).`
            });
            return;
        }
        
        // Create new conversation ID
        const conversationId = `conv_${Date.now()}`;
        const conversationStartQ = Math.floor(clickedQ / 2) * 2;
        
        // Create new message with coordinates
        const newMessage = {
            id: Date.now(),
            conversationId: conversationId,
            text: "**Welcome to a new conversation!** \\n\\n*Ready to explore new ideas together.*\\n\\nWhat would you like to discuss today?",
            sender: "ai",
            timestamp: new Date(),
            q: conversationStartQ,  // Always start at left column
            r: clickedR
        };

        // Create functional data tile
        const dataTile = new DataTile(
            newMessage.id,
            'message',
            newMessage,
            { q: conversationStartQ, r: clickedR }
        );
        tileGrid.addDataTile(dataTile);

        // Add message to state (this will trigger tile grid refresh)
        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // Lock to the new conversation using state manager
        conversationState.lock(conversationId, newMessage.id);
    }, [areColumnsAvailable, conversationState]);

    // Simple markdown renderer
    const renderMarkdown = (text) => {
        if (!text) return '';

        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^• (.*$)/gim, '<li>$1</li>')
            .replace(/\n/g, '<br/>');

        return { __html: html };
    };

    // No longer need to generate background hexes - using grid selection instead

    // Initialize animation manager
    useEffect(() => {
        animationManager.current = new AnimationManager(viewState, (newViewState) => {
            setViewState(newViewState);
            // Update LoD system when zoom changes
            lodManager.updateZoom(newViewState.zoom);
        });
        return () => {
            animationManager.current.stop();
        };
    }, []);
    
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
                setScreenCenter({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                });
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

    // Handle escape key - simplified to always unlock completely
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                // Always force complete unlock to prevent stuck states
                unlockConversation();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [unlockConversation]);

    const resetView = () => {
        // Reset to centered position instead of (0,0)
        const centeredViewState = {
            x: screenCenter.x,
            y: screenCenter.y,
            zoom: 1
        };
        animationManager.current.setViewState(centeredViewState);
        conversationState.unlock(); // Clear locked conversation
    };

    const lockToConversation = useCallback((q, r, messageId) => {
        // Check current LoD context level
        const currentState = lodManager.getCurrentState();
        
        if (currentState.context.level === CONTEXT_LEVELS.WORKSPACE) {
            // Find the message to get its conversationId
            const message = messages.find(m => m.id === messageId);
            const conversationId = message ? message.conversationId : `conv_${Math.floor(q / 2)}`;
            
            // Transition to conversation level
            lodManager.lockToConversation(conversationId, messageId);
            
            const zoom = 1.8;
            const clickedHexCenter = hexToPixel(q, r);
            
            // Find the conversation column (even number) that this message belongs to
            const conversationQ = Math.floor(q / 2) * 2;
            const conversationCenter = hexToPixel(conversationQ + 0.5, r); // Center between the two columns
            
            // Lock conversation using state manager
            conversationState.lock(conversationId, messageId);
            
            const worldTargetX = conversationCenter.x;
            const worldTargetY = clickedHexCenter.y;
            const newX = screenCenter.x - (worldTargetX * zoom);
            const newY = screenCenter.y - (worldTargetY * zoom);

            animationManager.current.setViewState({
                x: newX,
                y: newY,
                zoom: zoom
            });
            animationManager.current.setLocked(true);
            
        } else if (currentState.context.level === CONTEXT_LEVELS.CONVERSATION) {
            // Transition to message level - expand message to full viewport
            lodManager.expandToMessage(messageId);
            
            // Implement full viewport expansion animation
            const targetZoom = 2.5; // Larger zoom for message focus
            const messageCenter = hexToPixel(q, r); // Calculate center for this message
            const newX = screenCenter.x - (messageCenter.x * targetZoom);
            const newY = screenCenter.y - (messageCenter.y * targetZoom);
            
            animationManager.current.setViewState({
                x: newX,
                y: newY,
                zoom: targetZoom
            });
            
            console.log(`Expanding message ${messageId} to full viewport`);
        }
    }, [messages, screenCenter, hexToPixel]);

    const handleMouseDown = useCallback((e) => {
        if (e.target.tagName === 'INPUT' ||
            e.target.closest('.hex-input-container') ||
            e.target.closest('.hex-rich-input-editor') ||
            e.target.closest('.hex-editor-toolbar') ||
            e.target.closest('.hex-message-actions') ||
            (conversationState.isLocked && e.target.closest('.selectable-text')) ||
            (conversationState.isLocked && e.target.closest('.hex-message'))) {
            return;
        }

        // If locked and clicking outside the conversation, unlock (act as ESC)
        if (conversationState.isLocked) {
            unlockConversation();
            return;
        }

        setIsDragging(true);
        setLastMouse({ x: e.clientX, y: e.clientY });
        setStartMousePos({ x: e.clientX, y: e.clientY });
        animationManager.current.setInitialVelocity(0, 0);
        dragRef.current = false;
    }, [conversationState.isLocked, unlockConversation]);

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
        if (rect) {
            const worldX = (e.clientX - rect.left - viewState.x) / viewState.zoom;
            const worldY = (e.clientY - rect.top - viewState.y) / viewState.zoom;
            
            const tile = tileManager.getTileAtPixel(worldX, worldY);
            tileManager.setRightClickedTile(tile.q, tile.r);
            
            // Store right-clicked tile for context menu actions
        }
        
        contextMenuState.open(
            { x: e.clientX, y: e.clientY },
            { canStartNewChat: canStartNewChat }
        );
    }, [viewState, contextMenuState, canStartNewChat]);

    const handleCloseContextMenu = useCallback(() => {
        contextMenuState.close();
    }, [contextMenuState]);

    const handleHideErrorToast = useCallback(() => {
        setErrorToast(prev => ({ ...prev, visible: false }));
    }, []);

    const handleWheel = (e) => {
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
        if (!text) return '';

        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^• (.*$)/gim, '<li>$1</li>')
            .replace(/\n/g, '<br/>');

        return { __html: html };
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
            
            <HexagonSVG />
            <ZoomSlider
                viewState={viewState}
                onZoomSliderChange={handleZoomSlider}
            />

            <Controls
                isLocked={conversationState.isLocked}
                viewState={viewState}
                screenCenter={screenCenter}
                animationManager={animationManager}
                onExitLocked={unlockConversation}
                onResetView={resetView}
            />

            {/* Canvas Container */}
            <div
                ref={containerRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ zIndex: 1 }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={handleContextMenu}
            >
                {/* Hexagonal Grid */}
                <div
                    className="absolute inset-0 transition-transform duration-75 ease-out"
                    style={{
                        transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`,
                        transformOrigin: '0 0'
                    }}
                >
                    {/* Grid Selection Hover Effect */}
                    <GridSelection
                        x={gridSelection.x}
                        y={gridSelection.y}
                        hexSize={hexSize}
                        visible={gridSelection.visible}
                    />

                    {/* Conversation Thread */}
                    {messages.map((message, index) => {
                        // Use direct coordinates from message if available, otherwise fall back to old system
                        let position;
                        if (message.q !== undefined && message.r !== undefined) {
                            // New direct positioning system
                            position = { q: message.q, r: message.r };
                            // console.log(`Message ${message.id} using direct coordinates: (${message.q}, ${message.r})`);
                        } else {
                            // Old conversation positioning system
                            position = getMessagePosition(message, index);
                        }
                        
                        const pixelPosition = hexToPixel(position.q, position.r);

                        return (
                            <HexMessage
                                key={message.id}
                                message={message}
                                position={{ ...position, ...pixelPosition }}
                                hexSize={hexSize}
                                isLocked={conversationState.isLocked}
                                dragRef={dragRef}
                                onLockToConversation={(q, r) => lockToConversation(q, r, message.id)}
                                onCopyMessage={handleCopyMessage}
                                renderMarkdown={renderMarkdownMemo}
                                index={index}
                                zoom={viewState.zoom}
                                lodState={lodState}
                            />
                        );
                    })}

                    {/* Typing Indicator - animated */}
                    <AnimatedUITile 
                        isVisible={isTyping}
                        tileType="typing"
                        delay={50}
                    >
                        {isTyping && (
                            <TypingIndicator
                                position={{
                                    ...getInputPosition(),
                                    ...hexToPixel(getInputPosition().q, getInputPosition().r)
                                }}
                                hexSize={hexSize}
                            />
                        )}
                    </AnimatedUITile>

                    {/* Input Hex - animated based on conversation lock state */}
                    <AnimatedUITile 
                        isVisible={!isTyping && conversationState.isLocked}
                        tileType="input"
                        delay={100}
                    >
                        {!isTyping && conversationState.isLocked && (() => {
                            const inputPos = getInputPosition();
                            const inputPixelPos = hexToPixel(inputPos.q, inputPos.r);
                            
                            return (
                                <HexInput
                                    position={{
                                        ...inputPos,
                                        ...inputPixelPos
                                    }}
                                    hexSize={hexSize}
                                    inputRef={inputRef}
                                    inputText={inputText}
                                    onInputChange={setInputText}
                                    onSend={handleSend}
                                    isLocked={conversationState.isLocked}
                                    zoom={viewState.zoom}
                                    lodState={lodState}
                                />
                            );
                        })()}
                    </AnimatedUITile>
                </div>
            </div>

            <Instructions isLocked={conversationState.isLocked} />
            
            {/* Context Menu - Completely outside scalable layer with higher z-index */}
            <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 200, pointerEvents: 'none' }}>
                <div style={{ pointerEvents: 'auto' }}>
                    <ContextMenu
                        x={contextMenuState.position?.x || 0}
                        y={contextMenuState.position?.y || 0}
                        visible={contextMenuState.isOpen}
                        onClose={handleCloseContextMenu}
                        canStartNewChat={canStartNewChat}
                        onStartNewChat={startNewChat}
                    />
                </div>
            </div>
            
            {/* Error Toast */}
            <ErrorToast
                message={errorToast.message}
                visible={errorToast.visible}
                onHide={handleHideErrorToast}
            />
        </div>
    );
};

export default HexagonalMessageGrid;