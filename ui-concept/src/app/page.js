"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import AnimationManager from './animationManager';
import HexMessage from './components/HexMessage';
import HexInput from './components/HexInput';
import HexBackground from './components/HexBackground';
import TypingIndicator from './components/TypingIndicator';
import Controls from './components/Controls';
import ZoomSlider from './components/ZoomSlider';
import Instructions from './components/Instructions';
import HexagonSVG from './components/HexagonSVG';
import GridSelection from './components/GridSelection';

// Import CSS files
import './styles/hexagon.css';
import './styles/message.css';
import './styles/input.css';
import './styles/controls.css';

const HexagonalMessageGrid = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "**Neural interface initialized.** \n\n*System status: Online*\n\nHow may I assist you with your quantum computing research today?",
            sender: "ai",
            timestamp: new Date(Date.now() - 600000)
        },
        {
            id: 2,
            text: "I need help understanding **quantum entanglement protocols** for secure communication systems. Can you explain the key implementation strategies?",
            sender: 'user',
            timestamp: new Date(Date.now() - 580000)
        },
        {
            id: 3,
            text: "Quantum entanglement protocols involve creating **correlated quantum states** between particles separated by arbitrary distances.\n\n**Key implementations include:**\n• Bell state measurement\n• Quantum teleportation sequences\n• Distributed quantum key generation\n\nThese enable *provably secure* communication channels through quantum mechanical properties.",
            sender: "ai",
            timestamp: new Date(Date.now() - 560000)
        },
        {
            id: 4,
            text: "That's fascinating! How do we handle **quantum decoherence** in practical implementations? I'm particularly interested in error correction methods.",
            sender: 'user',
            timestamp: new Date(Date.now() - 540000)
        },
        {
            id: 5,
            text: "**Quantum Error Correction (QEC)** is crucial for practical systems:\n\n**Surface Codes:**\n• Use 2D lattice of qubits\n• Detect both bit-flip and phase-flip errors\n• Threshold ~1% error rate\n\n**Stabilizer Codes:**\n• Encode logical qubits in physical qubit states\n• Enable fault-tolerant operations\n• Examples: Shor code, Steane code\n\n*Decoherence times* typically range from microseconds to milliseconds depending on the physical implementation.",
            sender: "ai",
            timestamp: new Date(Date.now() - 520000)
        },
        {
            id: 6,
            text: "What about **scalability challenges**? How do current quantum systems compare to classical distributed systems in terms of network topology and latency?",
            sender: 'user',
            timestamp: new Date(Date.now() - 500000)
        },
        {
            id: 7,
            text: "**Scalability remains a major challenge:**\n\n**Current Limitations:**\n• Limited qubit counts (100-1000 range)\n• High error rates (~0.1-1%)\n• Short coherence times\n\n**Network Topology:**\n• *Star configurations* for small networks\n• *Linear chains* for quantum repeaters\n• *Mesh topologies* for fault tolerance\n\n**Latency Comparison:**\n• Classical: ~1-100ms global\n• Quantum: Limited by light speed + processing\n• Quantum repeaters add ~10-100ms per hop\n\nThe **quantum internet** will likely use hybrid classical-quantum protocols for optimal performance.",
            sender: "ai",
            timestamp: new Date(Date.now() - 480000)
        },
        {
            id: 8,
            text: "Interesting! Can you provide some **concrete examples** of companies or research institutions that are successfully implementing these quantum communication protocols at scale?",
            sender: 'user',
            timestamp: new Date(Date.now() - 460000)
        },
        {
            id: 9,
            text: "**Leading Quantum Communication Implementations:**\n\n**Commercial Deployments:**\n• **ID Quantique** - Quantum key distribution networks in Geneva and Vienna\n• **Toshiba** - QKD links in UK and Japan (100+ km fiber)\n• **QuantumCTek** - Chinese quantum communication backbone\n\n**Research Institutions:**\n• **MIT Lincoln Lab** - Quantum internet testbed\n• **Delft University** - Quantum network node experiments\n• **University of Vienna** - Long-distance quantum teleportation\n\n**Recent Milestones:**\n• China's *Micius satellite* - 1200km quantum communication\n• European Quantum Internet Alliance - Multi-node networks\n• IBM Q Network - 20+ quantum computers accessible globally\nMost systems currently operate at **kilobit/second** rates with plans to reach megabit speeds by 2030.",
            sender: "ai",
            timestamp: new Date(Date.now() - 440000)
        }
    ]);

    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
    const [startMousePos, setStartMousePos] = useState({ x: 0, y: 0 });
    const [isLocked, setIsLocked] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [screenCenter, setScreenCenter] = useState({ x: 0, y: 0 });
    const [gridSelection, setGridSelection] = useState({ visible: false, x: 0, y: 0 });

    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dragRef = useRef(false);
    const animationManager = useRef(null);

    // Hexagon math utilities
    const hexSize = 180;

    const hexToPixel = (q, r) => {
        const x = hexSize * (3 / 2 * q);
        const y = hexSize * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
        return { x, y };
    };

    // Generate conversation thread in strict 2-column vertical pattern
    const getConversationPositions = () => {
        const positions = [];

        for (let i = 0; i < 25; i++) {
            const row = Math.floor(i / 2);
            const isLeft = i % 2 === 0;

            if (isLeft) {
                positions.push({ q: 0, r: row });
            } else {
                positions.push({ q: 1, r: row });
            }
        }

        return positions;
    };

    const conversationPositions = useMemo(() => getConversationPositions(), []);

    // Convert pixel coordinates to hex grid coordinates
    const pixelToHex = useCallback((pixelX, pixelY) => {
        const x = pixelX / hexSize;
        const y = pixelY / hexSize;
        
        const q = Math.round((2 / 3) * x);
        const r = Math.round((-1 / 3) * x + (Math.sqrt(3) / 3) * y);
        
        return { q, r };
    }, []);

    // Check if a hex position is occupied by a message
    const isHexOccupied = useCallback((q, r) => {
        const usedPositions = new Set();
        conversationPositions.slice(0, messages.length + 1).forEach(pos => {
            usedPositions.add(`${pos.q},${pos.r}`);
        });
        return usedPositions.has(`${q},${r}`);
    }, [conversationPositions, messages.length]);

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
        });
        return () => {
            animationManager.current.stop();
        };
    }, []);

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

    // Handle escape key to exit locked mode
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape' && isLocked) {
                animationManager.current.setLocked(false);
                setIsLocked(false);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isLocked]);

    const resetView = () => {
        animationManager.current.reset();
        setIsLocked(false);
    };

    const lockToConversation = (q, r) => {
        const zoom = 1.8;
        const clickedHexCenter = hexToPixel(q, r);
        const worldTargetX = hexSize * 0.75;
        const worldTargetY = clickedHexCenter.y;
        const newX = screenCenter.x - (worldTargetX * zoom);
        const newY = screenCenter.y - (worldTargetY * zoom);

        animationManager.current.setViewState({
            x: newX,
            y: newY,
            zoom: zoom
        });
        animationManager.current.setLocked(true);
        setIsLocked(true);
    };

    const handleMouseDown = useCallback((e) => {
        if (e.target.tagName === 'INPUT' ||
            e.target.closest('.hex-input-container') ||
            e.target.closest('.hex-rich-input-editor') ||
            e.target.closest('.hex-editor-toolbar') ||
            e.target.closest('.hex-message-actions') ||
            (isLocked && e.target.closest('.selectable-text')) ||
            (isLocked && e.target.closest('.hex-message'))) {
            return;
        }

        setIsDragging(true);
        setLastMouse({ x: e.clientX, y: e.clientY });
        setStartMousePos({ x: e.clientX, y: e.clientY });
        animationManager.current.setInitialVelocity(0, 0);
        dragRef.current = false;
    }, [isLocked]);

    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });

        // Calculate grid selection position (only in browser)
        if (typeof window !== 'undefined' && !isDragging && !isLocked) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                // Convert screen coordinates to world coordinates
                const worldX = (e.clientX - rect.left - viewState.x) / viewState.zoom;
                const worldY = (e.clientY - rect.top - viewState.y) / viewState.zoom;
                
                // Convert to hex coordinates
                const hexCoords = pixelToHex(worldX, worldY);
                
                // Check if this position is not occupied and within reasonable bounds
                const maxRadius = 12;
                const distance = Math.sqrt(hexCoords.q * hexCoords.q + hexCoords.r * hexCoords.r);
                
                if (distance <= maxRadius && !isHexOccupied(hexCoords.q, hexCoords.r)) {
                    const pixelPos = hexToPixel(hexCoords.q, hexCoords.r);
                    setGridSelection({
                        visible: true,
                        x: pixelPos.x,
                        y: pixelPos.y
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

        if (isLocked) {
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

    const handleWheel = (e) => {
        e.preventDefault();

        if (isLocked) {
            const deltaY = e.deltaY * 2;
            animationManager.current.updatePosition(0, -deltaY);
        } else {
            const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
            const newZoom = Math.max(0.4, Math.min(3.0, viewState.zoom * zoomFactor));
            const mouseX = mousePos.x;
            const mouseY = mousePos.y;
            animationManager.current.setZoom(newZoom, mouseX, mouseY, screenCenter);
        }
    };

    const handleZoomSlider = (e) => {
        const newZoom = parseFloat(e.target.value);
        if (isLocked) {
            animationManager.current.setViewState({ ...viewState, zoom: newZoom });
        } else {
            const centerX = screenCenter.x;
            const centerY = screenCenter.y;
            animationManager.current.setZoom(newZoom, centerX, centerY, screenCenter);
        }
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
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 relative overflow-hidden">
            <HexagonSVG />
            <ZoomSlider
                viewState={viewState}
                onZoomSliderChange={handleZoomSlider}
            />

            <Controls
                isLocked={isLocked}
                viewState={viewState}
                screenCenter={screenCenter}
                animationManager={animationManager}
                onExitLocked={() => setIsLocked(false)}
                onResetView={resetView}
            />

            {/* Canvas Container */}
            <div
                ref={containerRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
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
                        const position = conversationPositions[index];
                        const pixelPosition = hexToPixel(position.q, position.r);

                        return (
                            <HexMessage
                                key={message.id}
                                message={message}
                                position={{ ...position, ...pixelPosition }}
                                hexSize={hexSize}
                                isLocked={isLocked}
                                dragRef={dragRef}
                                onLockToConversation={lockToConversation}
                                onCopyMessage={handleCopyMessage}
                                renderMarkdown={renderMarkdownMemo}
                                index={index}
                                zoom={viewState.zoom}
                            />
                        );
                    })}

                    {/* Typing Indicator */}
                    {isTyping && (
                        <TypingIndicator
                            position={{
                                ...conversationPositions[messages.length],
                                ...hexToPixel(conversationPositions[messages.length].q, conversationPositions[messages.length].r)
                            }}
                            hexSize={hexSize}
                        />
                    )}

                    {/* Input Hex */}
                    {!isTyping && (
                        <HexInput
                            position={{
                                ...conversationPositions[messages.length],
                                ...hexToPixel(conversationPositions[messages.length].q, conversationPositions[messages.length].r)
                            }}
                            hexSize={hexSize}
                            inputRef={inputRef}
                            inputText={inputText}
                            onInputChange={setInputText}
                            onSend={handleSend}
                            isLocked={isLocked}
                            zoom={viewState.zoom}
                        />
                    )}
                </div>
            </div>

            <Instructions isLocked={isLocked} />
        </div>
    );
};

export default HexagonalMessageGrid;