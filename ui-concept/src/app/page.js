"use client";

import React, {useEffect, useRef, useState, useMemo} from 'react';
import AnimationManager from './animationManager';
import Hexagon from './components/Hexagon';
import {
    Bold,
    Bot,
    Code,
    Copy,
    GitBranch,
    Italic,
    Minus,
    Paperclip,
    Plus,
    RotateCcw,
    RotateCw,
    Send,
    User,
    X
} from 'lucide-react';

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
    const [viewState, setViewState] = useState({x: 0, y: 0, zoom: 1}); // This will be updated by AnimationManager
    const [isDragging, setIsDragging] = useState(false);
    const [lastMouse, setLastMouse] = useState({x: 0, y: 0});
    const [startMousePos, setStartMousePos] = useState({x: 0, y: 0}); // New state for click detection
    const [isLocked, setIsLocked] = useState(false);
    const [mousePos, setMousePos] = useState({x: 0, y: 0});
    const [screenCenter, setScreenCenter] = useState({ x: 0, y: 0 }); // <-- FIX: Added state for screen center
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dragRef = useRef(false); // New ref to track if a drag occurred

    const animationManager = useRef(null);
    useEffect(() => {
        animationManager.current = new AnimationManager(viewState, (newViewState) => {
            setViewState(newViewState);
        });
        return () => {
            animationManager.current.stop();
        };
    }, []);

    // Hexagon math utilities
    const hexSize = 180;

    const hexToPixel = (q, r) => {
        const x = hexSize * (3 / 2 * q);
        const y = hexSize * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
        return {x, y};
    };

    // Generate conversation thread in strict 2-column vertical pattern
    const getConversationPositions = () => {
        const positions = [];

        // Strict 2-hex wide vertical column, alternating left-right
        for (let i = 0; i < 25; i++) {
            const row = Math.floor(i / 2);
            const isLeft = i % 2 === 0;

            if (isLeft) {
                positions.push({q: 0, r: row});     // Left column
            } else {
                positions.push({q: 1, r: row});     // Right column
            }
        }

        return positions;
    };

    const conversationPositions = getConversationPositions();

    // Simple markdown renderer
    const renderMarkdown = (text) => {
        if (!text) return '';

        // Convert markdown to HTML-like structure
        let html = text
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Bullet points
            .replace(/^• (.*$)/gim, '<li>$1</li>')
            // Line breaks
            .replace(/\n/g, '<br/>');

        return {__html: html};
    };

    // Generate background hexagons around conversation thread
    const generateBackgroundHexes = () => {
        const hexagons = [];
        const radius = 8;
        const usedPositions = new Set();

        // Mark conversation positions as used (including input hex)
        conversationPositions.slice(0, messages.length + 1).forEach(pos => {
            usedPositions.add(`${pos.q},${pos.r}`);
        });

        for (let q = -radius; q <= radius; q++) {
            const r1 = Math.max(-radius, -q - radius);
            const r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) {
                if (!usedPositions.has(`${q},${r}`)) {
                    const {x, y} = hexToPixel(q, r);
                    hexagons.push({q, r, x, y});
                }
            }
        }
        return hexagons;
    };

    const resetView = () => {
        animationManager.current.reset();
        setIsLocked(false);
    };

    const lockToConversation = (q, r) => {
        const zoom = 1.8; // 180% zoom

        // hexToPixel(q, r) returns the center of the hex
        const clickedHexCenter = hexToPixel(q, r);

        // World X-coordinate for the horizontal center of the two-column layout
        // This is the midpoint between the centers of the q=0 and q=1 hexes.
        const worldTargetX = hexSize * 0.75;

        // World Y-coordinate for the vertical center of the clicked hex
        const worldTargetY = clickedHexCenter.y;

        // Calculate the new viewState.x and viewState.y
        // These values are the translations needed to bring worldTargetX/Y to the screen center
        // after scaling, considering that screenCenter.x/y is already part of the CSS transform.
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

    // <-- FIX: New useEffect to safely access window dimensions
    useEffect(() => {
        const updateCenter = () => {
            setScreenCenter({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
            });
        };

        updateCenter(); // Set initial center

        window.addEventListener('resize', updateCenter);
        return () => window.removeEventListener('resize', updateCenter);
    }, []); // Empty dependency array means it runs once on mount

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

    const handleMouseDown = (e) => {
        // Don't start drag if clicking on input, selectable text, or message hex
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
        setLastMouse({x: e.clientX, y: e.clientY});
        setStartMousePos({x: e.clientX, y: e.clientY}); // Record start position
        animationManager.current.setInitialVelocity(0, 0);
        dragRef.current = false; // Reset drag flag
    };

    const handleMouseMove = (e) => {
        // Always track mouse position for zoom centering
        setMousePos({x: e.clientX, y: e.clientY});

        if (!isDragging) return;

        const deltaX = e.clientX - lastMouse.x;
        const deltaY = e.clientY - lastMouse.y;

        // If mouse moves significantly, it's a drag
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            dragRef.current = true;
        }

        if (isLocked) {
            // Only allow vertical movement when locked
            animationManager.current.updatePosition(0, deltaY);
            animationManager.current.setInitialVelocity(0, deltaY * 0.3);
        } else {
            animationManager.current.updatePosition(deltaX, deltaY);
            animationManager.current.setInitialVelocity(deltaX * 0.3, deltaY * 0.3);
        }

        setLastMouse({x: e.clientX, y: e.clientY});
    };

    const handleMouseUp = (e) => {
        setIsDragging(false);

        // Check if it was a click (not a drag)
        const distance = Math.sqrt(
            Math.pow(e.clientX - startMousePos.x, 2) +
            Math.pow(e.clientY - startMousePos.y, 2)
        );

        if (distance < 5) { // Threshold for a click
            // This was a click, not a drag
            // The logic for locking to conversation will be handled in the hex-message onClick
        }
    };

    const handleWheel = (e) => {
        e.preventDefault();

        if (isLocked) {
            // Only allow vertical scrolling when locked
            const deltaY = e.deltaY * 2; // Increase scroll sensitivity
            animationManager.current.updatePosition(0, -deltaY);
        } else {
            // Zoom towards mouse position
            const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
            const newZoom = Math.max(0.4, Math.min(3.0, viewState.zoom * zoomFactor));

            // <-- FIX: Use screenCenter state instead of window
            const mouseX = mousePos.x;
            const mouseY = mousePos.y;

            animationManager.current.setZoom(newZoom, mouseX, mouseY, screenCenter);
        }
    };

    const handleZoomSlider = (e) => {
        const newZoom = parseFloat(e.target.value);
        if (isLocked) {
            animationManager.current.setViewState({...viewState, zoom: newZoom});
        } else {
            // Center zoom on screen center when using slider
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

        // Clear the rich text editor
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

    const backgroundHexes = useMemo(() => generateBackgroundHexes(), []);

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 relative overflow-hidden">
            {/* Zoom Slider - Bottom Horizontal */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50">
                <div className="glass-panel-slim flex items-center space-x-4">
                    <div className="text-white/60 text-xs font-mono tracking-wider">
                        ZOOM
                    </div>
                    <input
                        type="range"
                        min="0.4"
                        max="3.0"
                        step="0.1"
                        value={viewState.zoom}
                        onChange={handleZoomSlider}
                        className="zoom-slider-horizontal"
                    />
                    <div className="text-white/40 text-xs font-mono">
                        {Math.round(viewState.zoom * 100)}%
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="absolute top-6 right-6 z-50 flex flex-col space-y-2">
                {isLocked && (
                    <button
                        onClick={() => setIsLocked(false)}
                        className="glass-control-button exit-button"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                )}
                {!isLocked && (
                    <>
                        <button
                            onClick={() => animationManager.current.setZoom(Math.min(3.0, viewState.zoom * 1.25), screenCenter.x, screenCenter.y, screenCenter)}
                            className="glass-control-button"
                        >
                            <Plus className="w-4 h-4"/>
                        </button>
                        <button
                            onClick={() => animationManager.current.setZoom(Math.max(0.4, viewState.zoom * 0.8), screenCenter.x, screenCenter.y, screenCenter)}
                            className="glass-control-button"
                        >
                            <Minus className="w-4 h-4"/>
                        </button>
                        <button onClick={resetView} className="glass-control-button">
                            <RotateCcw className="w-4 h-4"/>
                        </button>
                    </>
                )}
            </div>

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
                        // <-- FIX: Use screenCenter state instead of window
                        transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`,
                        transformOrigin: '0 0'
                    }}
                >
                    

                    {/* Background Hexagons */}
                    {backgroundHexes.map(({q, r, x, y}) => (
                        <Hexagon
                            key={`bg-${q}-${r}`}
                            q={q}
                            r={r}
                            x={x}
                            y={y}
                            hexSize={hexSize}
                            className="hex-empty"
                        >
                            <div className="hex-background"></div>
                        </Hexagon>
                    ))}

                    {/* Conversation Thread */}
                    {messages.map((message, index) => {
                        const position = conversationPositions[index];
                        const {x, y} = hexToPixel(position.q, position.r);

                        return (
                            <Hexagon
                                key={message.id}
                                q={position.q}
                                r={position.r}
                                x={x}
                                y={y}
                                hexSize={hexSize}
                                className={`animate-fade-in`}
                                style={{ animationDelay: `${index * 200}ms` }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isLocked && !dragRef.current) {
                                        lockToConversation(position.q, position.r);
                                    }
                                }}
                            >
                                <div
                                    className={`hex-message ${message.sender === 'user' ? 'hex-message-user' : 'hex-message-ai'} ${isLocked ? 'in-locked-mode' : ''}`}
                                >
                                    {/* Avatar */}
                                    <div
                                        className={`hex-avatar ${message.sender === 'user' ? 'hex-avatar-user' : 'hex-avatar-ai'}`}>
                                        {message.sender === 'user' ?
                                            <User className="w-3 h-3 text-cyan-300"/> :
                                            <Bot className="w-3 h-3 text-white/90"/>
                                        }
                                    </div>

                                    {/* Message Content */}
                                    <div
                                        className="hex-content"
                                        onWheel={(e) => {
                                            if (isLocked) {
                                                const element = e.currentTarget;
                                                const hasScrollbar = element.scrollHeight > element.clientHeight;

                                                if (hasScrollbar) {
                                                    const isAtTop = element.scrollTop === 0;
                                                    const isAtBottom = element.scrollTop >= element.scrollHeight - element.clientHeight;
                                                    const scrollingUp = e.deltaY < 0;
                                                    const scrollingDown = e.deltaY > 0;

                                                    if ((scrollingUp && !isAtTop) || (scrollingDown && !isAtBottom)) {
                                                        e.stopPropagation();
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        <div
                                            className="hex-text selectable-text"
                                            dangerouslySetInnerHTML={renderMarkdown(message.text)}
                                        />
                                    </div>
                                    <p className="hex-timestamp">
                                        {message.timestamp.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>

                                    {/* Message Actions */}
                                    <div className="hex-message-actions">
                                        <button
                                            className="hex-action-button copy"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(message.text);
                                            }}
                                            title="Copy message"
                                        >
                                            <Copy className="w-2 h-2"/>
                                        </button>
                                        {/* Vista-only buttons */}
                                        <button
                                            className="hex-action-button rerun"
                                            onClick={(e) => e.stopPropagation()}
                                            title="Re-run"
                                        >
                                            <RotateCw className="w-2 h-2"/>
                                        </button>
                                        <button
                                            className="hex-action-button branch"
                                            onClick={(e) => e.stopPropagation()}
                                            title="Branch conversation"
                                        >
                                            <GitBranch className="w-2 h-2"/>
                                        </button>
                                    </div>
                                </div>
                            </Hexagon>
                        );
                    })}

                    {/* Typing Indicator */}
                    {isTyping && (
                        <Hexagon
                            q={conversationPositions[messages.length].q}
                            r={conversationPositions[messages.length].r}
                            x={hexToPixel(conversationPositions[messages.length].q, conversationPositions[messages.length].r).x}
                            y={hexToPixel(conversationPositions[messages.length].q, conversationPositions[messages.length].r).y}
                            hexSize={hexSize}
                            className="animate-fade-in"
                        >
                            <div className="hex-message hex-message-ai">
                                <div className="hex-avatar hex-avatar-ai">
                                    <Bot className="w-3 h-3 text-white/90"/>
                                </div>
                                <div className="hex-content">
                                    <div className="flex space-x-1 justify-center">
                                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                                             style={{animationDelay: '200ms'}}></div>
                                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                                             style={{animationDelay: '400ms'}}></div>
                                    </div>
                                </div>
                            </div>
                        </Hexagon>
                    )}

                    {/* Input Hex - Compact Page Editor */}
                    {!isTyping && (
                        <Hexagon
                            q={conversationPositions[messages.length].q}
                            r={conversationPositions[messages.length].r}
                            x={hexToPixel(conversationPositions[messages.length].q, conversationPositions[messages.length].r).x}
                            y={hexToPixel(conversationPositions[messages.length].q, conversationPositions[messages.length].r).y}
                            hexSize={hexSize}
                        >
                            <div className="hex-input-message-editor">
                                {/* Formatting Controls */}
                                <div className="hex-editor-toolbar">
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            document.execCommand('bold');
                                            inputRef.current?.focus();
                                        }}
                                        className="hex-format-button"
                                        title="Bold (Ctrl+B)"
                                    >
                                        <Bold className="w-2 h-2"/>
                                    </button>
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            document.execCommand('italic');
                                            inputRef.current?.focus();
                                        }}
                                        className="hex-format-button"
                                        title="Italic (Ctrl+I)"
                                    >
                                        <Italic className="w-2 h-2"/>
                                    </button>
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            const selection = window.getSelection();
                                            if (selection && selection.toString()) {
                                                document.execCommand('insertText', false, `\`${selection.toString()}\``);
                                            } else {
                                                document.execCommand('insertText', false, '``');
                                                // Move cursor between backticks
                                                const range = selection.getRangeAt(0);
                                                range.setStart(range.startContainer, range.startOffset - 1);
                                                range.collapse(true);
                                                selection.removeAllRanges();
                                                selection.addRange(range);
                                            }
                                            inputRef.current?.focus();
                                        }}
                                        className="hex-format-button"
                                        title="Code"
                                    >
                                        <Code className="w-2 h-2"/>
                                    </button>
                                </div>

                                {/* Rich Text Input */}
                                <div
                                    ref={inputRef}
                                    contentEditable
                                    suppressContentEditableWarning={true}
                                    className="hex-rich-input-editor"
                                    onInput={(e) => setInputText(e.target.textContent || '')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                        // Allow basic formatting shortcuts
                                        if (e.ctrlKey || e.metaKey) {
                                            if (e.key === 'b') {
                                                e.preventDefault();
                                                document.execCommand('bold');
                                            } else if (e.key === 'i') {
                                                e.preventDefault();
                                                document.execCommand('italic');
                                            }
                                        }
                                    }}
                                    onWheel={(e) => {
                                        if (isLocked) {
                                            const element = e.currentTarget;
                                            const hasScrollbar = element.scrollHeight > element.clientHeight;

                                            if (hasScrollbar) {
                                                const isAtTop = element.scrollTop === 0;
                                                const isAtBottom = element.scrollTop >= element.scrollHeight - element.clientHeight;
                                                const scrollingUp = e.deltaY < 0;
                                                const scrollingDown = e.deltaY > 0;

                                                if ((scrollingUp && !isAtTop) || (scrollingDown && !isAtBottom)) {
                                                    e.stopPropagation();
                                                }
                                            }
                                        }
                                    }}
                                    data-placeholder="Continue thread..."
                                />

                                {/* Send Button Row */}
                                <div className="hex-button-row">
                                    <button
                                        className="hex-attach-button"
                                        title="Attach file"
                                    >
                                        <Paperclip className="w-2 h-2"/>
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        disabled={!inputText.trim()}
                                        className="hex-send-button-editor"
                                    >
                                        <Send className="w-2 h-2 mr-1"/>
                                        Send
                                    </button>
                                </div>
                            </div>
                        </Hexagon>
                    )}
                </div>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-20 right-6 z-50">
                <div className="glass-panel text-white/60 text-xs font-mono tracking-wider space-y-1">
                    {isLocked ? (
                        <>
                            <div>SCROLL TO NAVIGATE</div>
                            <div>ESC OR ✕ TO EXIT</div>
                            <div>LOCKED AT 180%</div>
                        </>
                    ) : (
                        <>
                            <div>CLICK HEX TO FOCUS</div>
                            <div>DRAG TO PAN</div>
                            <div>WHEEL TO ZOOM</div>
                        </>
                    )}
                </div>
            </div>

            <style jsx>{`
                /* Hexagon Styles */
                .hex-tile {
                    transition: all 0.3s ease;
                    width: 100%;
                    height: 100%;
                }

                .hex-background {
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.02);
                    border: none;
                    transition: all 0.3s ease;
                    clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
                }

                .hex-empty:hover .hex-background {
                    background: rgba(255, 255, 255, 0.01);
                    border: none;
                }

                .hex-message {
                    width: 100%;
                    height: 100%;
                    -webkit-backdrop-filter: blur(12px) saturate(180%);
                    backdrop-filter: blur(12px) saturate(180%);
                    background: rgba(255, 255, 255, 0.02);
                    border: none;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                    padding: 16px;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                }

                .hex-message:hover {
                    -webkit-backdrop-filter: blur(16px) saturate(200%);
                    backdrop-filter: blur(16px) saturate(200%);
                    background: rgba(255, 255, 255, 0.08);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
                }

                .hex-message:not(.in-locked-mode):hover {
                    transform: scale(1.08) translateY(-3px);
                    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
                }

                .hex-message-user {
                    background: rgba(6, 182, 212, 0.02);
                    border: none;
                }

                .hex-message-user:hover {
                    background: rgba(6, 182, 212, 0.25);
                    border: none;
                }

                .hex-message-ai {
                    background: rgba(255, 255, 255, 0.02);
                    border: none;
                }

                /* Input Message Editor */
                .hex-input-message-editor {
                    width: 100%;
                    height: 100%;
                    -webkit-backdrop-filter: blur(12px);
                    backdrop-filter: blur(12px);
                    background: rgba(255, 255, 255, 0.08);
                    border: none;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                    clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    padding: 12px;
                    transition: all 0.3s ease;
                    gap: 6px;
                }

                .hex-input-message-editor:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border: none;
                    transform: scale(1.01);
                }

                .hex-editor-toolbar {
                    display: flex;
                    gap: 2px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    justify-content: center;
                    width: 160px;
                    margin: 0 auto;
                }

                .hex-format-button {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: rgba(255, 255, 255, 0.6);
                    padding: 2px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .hex-format-button:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    color: rgba(255, 255, 255, 0.9);
                    transform: scale(1.05);
                }

                .hex-format-button:active {
                    background: rgba(6, 182, 212, 0.2);
                    border: 1px solid rgba(6, 182, 212, 0.4);
                    color: rgba(6, 182, 212, 1);
                }

                .hex-rich-input-editor {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 6px 4px;
                    font-size: 8px;
                    font-weight: 300;
                    outline: none;
                    min-height: 100px;
                    max-height: 160px;
                    overflow-y: auto;
                    line-height: 1.4;
                    word-wrap: break-word;
                    user-select: text;
                    cursor: text;
                    width: 160px;
                    margin: 0 auto;
                }

                .hex-rich-input-editor:empty:before {
                    content: attr(data-placeholder);
                    color: rgba(255, 255, 255, 0.3);
                    font-style: italic;
                    font-size: 7px;
                }

                .hex-rich-input-editor:focus:empty:before {
                    content: "";
                }

                .hex-rich-input-editor strong {
                    font-weight: 600;
                    color: rgba(255, 255, 255, 1);
                }

                .hex-rich-input-editor em {
                    font-style: italic;
                    color: rgba(6, 182, 212, 0.9);
                }

                .hex-rich-input-editor code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 1px 3px;
                    font-family: monospace;
                    font-size: 7px;
                    color: rgba(34, 197, 94, 0.9);
                }

                .hex-rich-input-editor::selection {
                    background: rgba(6, 182, 212, 0.3);
                }

                .hex-rich-input-editor::-webkit-scrollbar {
                    width: 2px;
                }

                .hex-rich-input-editor::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                }

                .hex-rich-input-editor::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 1px;
                }

                .hex-send-button-editor {
                    background: rgba(6, 182, 212, 0.2);
                    border: 1px solid rgba(6, 182, 212, 0.4);
                    color: white;
                    padding: 4px 8px;
                    font-size: 7px;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                    transition: all 0.2s ease;
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .hex-attach-button {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: rgba(255, 255, 255, 0.7);
                    padding: 4px;
                    transition: all 0.2s ease;
                    margin-right: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .hex-attach-button:hover {
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    transform: scale(1.05);
                }

                .hex-button-row {
                    display: flex;
                    width: 160px;
                    margin: 4px auto 0;
                    gap: 4px;
                    align-items: center;
                }

                .hex-send-button-editor:hover:not(:disabled) {
                    background: rgba(6, 182, 212, 0.3);
                    border: 1px solid rgba(6, 182, 212, 0.6);
                    transform: scale(1.02);
                }

                .hex-send-button-editor:disabled {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.3);
                    opacity: 0.5;
                }

                .hex-avatar {
                    -webkit-backdrop-filter: blur(8px);
                    backdrop-filter: blur(8px);
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    border-radius: 50%;
                    padding: 6px;
                    margin-bottom: 8px;
                    flex-shrink: 0;
                }

                .hex-avatar-user {
                    background: rgba(6, 182, 212, 0.3);
                    border: 1px solid rgba(6, 182, 212, 0.6);
                }

                .hex-avatar-ai {
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                }

                .hex-content {
                    text-align: left;
                    width: 100%;
                    max-width: 180px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    max-height: 200px;
                    padding-right: 4px;
                }

                .hex-content::-webkit-scrollbar {
                    width: 3px;
                }

                .hex-content::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 2px;
                }

                .hex-content::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 2px;
                }

                .hex-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .hex-text {
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 8px;
                    line-height: 1.4;
                    font-weight: 300;
                    margin-bottom: 6px;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    hyphens: auto;
                    flex: 1;
                }

                .selectable-text {
                    user-select: none;
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                }

                .hex-message.in-locked-mode .selectable-text {
                    user-select: text;
                    -webkit-user-select: text;
                    -moz-user-select: text;
                    -ms-user-select: text;
                }

                .selectable-text::selection {
                    background: rgba(6, 182, 212, 0.3);
                    color: white;
                }

                .selectable-text::-moz-selection {
                    background: rgba(6, 182, 212, 0.3);
                    color: white;
                }

                .hex-text strong {
                    color: rgba(255, 255, 255, 1);
                    font-weight: 600;
                }

                .hex-text em {
                    color: rgba(6, 182, 212, 0.9);
                    font-style: italic;
                }

                .hex-text code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 1px 3px;
                    font-family: monospace;
                    font-size: 9px;
                    color: rgba(34, 197, 94, 0.9);
                }

                .hex-text li {
                    margin-left: 8px;
                    list-style: none;
                    position: relative;
                }

                .hex-text li:before {
                    content: "•";
                    color: rgba(6, 182, 212, 0.8);
                    margin-right: 4px;
                }

                .hex-timestamp {
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 8px;
                    font-family: monospace;
                    letter-spacing: 0.5px;
                    margin-top: auto;
                    flex-shrink: 0;
                    margin-bottom: 6px;
                }

                .hex-message-actions {
                    display: flex;
                    gap: 2px;
                    justify-content: flex-end;
                    margin-top: 4px;
                }

                .hex-action-button {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: rgba(255, 255, 255, 0.6);
                    padding: 2px;
                    font-size: 6px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .hex-action-button:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    color: rgba(255, 255, 255, 0.9);
                    transform: scale(1.05);
                }

                .hex-action-button.copy {
                    color: rgba(34, 197, 94, 0.8);
                    border-color: rgba(34, 197, 94, 0.3);
                }

                .hex-action-button.copy:hover {
                    background: rgba(34, 197, 94, 0.1);
                    color: rgba(34, 197, 94, 1);
                    border-color: rgba(34, 197, 94, 0.5);
                }

                .hex-action-button.rerun {
                    color: rgba(6, 182, 212, 0.8);
                    border-color: rgba(6, 182, 212, 0.3);
                }

                .hex-action-button.rerun:hover {
                    background: rgba(6, 182, 212, 0.1);
                    color: rgba(6, 182, 212, 1);
                    border-color: rgba(6, 182, 212, 0.5);
                }

                .hex-action-button.branch {
                    color: rgba(147, 51, 234, 0.8);
                    border-color: rgba(147, 51, 234, 0.3);
                }

                .hex-action-button.branch:hover {
                    background: rgba(147, 51, 234, 0.1);
                    color: rgba(147, 51, 234, 1);
                    border-color: rgba(147, 51, 234, 0.5);
                }


                .hex-editor-toolbar {
                    display: flex;
                    gap: 2px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    justify-content: center;
                    width: 160px;
                    margin: 0 auto;
                }

                .hex-format-button {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: rgba(255, 255, 255, 0.6);
                    padding: 2px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .hex-format-button:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    color: rgba(255, 255, 255, 0.9);
                    transform: scale(1.05);
                }

                .hex-format-button:active {
                    background: rgba(6, 182, 212, 0.2);
                    border: 1px solid rgba(6, 182, 212, 0.4);
                    color: rgba(6, 182, 212, 1);
                }

                .hex-rich-input-editor {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 6px 4px;
                    font-size: 8px;
                    font-weight: 300;
                    outline: none;
                    min-height: 100px;
                    max-height: 160px;
                    overflow-y: auto;
                    line-height: 1.4;
                    word-wrap: break-word;
                    user-select: text;
                    cursor: text;
                    width: 160px;
                    margin: 0 auto;
                }

                .hex-rich-input-editor:empty:before {
                    content: attr(data-placeholder);
                    color: rgba(255, 255, 255, 0.3);
                    font-style: italic;
                    font-size: 7px;
                }

                .hex-rich-input-editor:focus:empty:before {
                    content: "";
                }

                .hex-rich-input-editor strong {
                    font-weight: 600;
                    color: rgba(255, 255, 255, 1);
                }

                .hex-rich-input-editor em {
                    font-style: italic;
                    color: rgba(6, 182, 212, 0.9);
                }

                .hex-rich-input-editor code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 1px 3px;
                    font-family: monospace;
                    font-size: 7px;
                    color: rgba(34, 197, 94, 0.9);
                }

                .hex-rich-input-editor::selection {
                    background: rgba(6, 182, 212, 0.3);
                }

                .hex-rich-input-editor::-webkit-scrollbar {
                    width: 2px;
                }

                .hex-rich-input-editor::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                }

                .hex-rich-input-editor::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 1px;
                }

                .hex-send-button-editor {
                    background: rgba(6, 182, 212, 0.2);
                    border: 1px solid rgba(6, 182, 212, 0.4);
                    color: white;
                    padding: 4px 8px;
                    font-size: 7px;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                    transition: all 0.2s ease;
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .hex-attach-button {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: rgba(255, 255, 255, 0.7);
                    padding: 4px;
                    transition: all 0.2s ease;
                    margin-right: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .hex-attach-button:hover {
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    transform: scale(1.05);
                }

                .hex-button-row {
                    display: flex;
                    width: 160px;
                    margin: 4px auto 0;
                    gap: 4px;
                    align-items: center;
                }

                .hex-send-button-editor:hover:not(:disabled) {
                    background: rgba(6, 182, 212, 0.3);
                    border: 1px solid rgba(6, 182, 212, 0.6);
                    transform: scale(1.02);
                }

                .hex-send-button-editor:hover:not(:disabled) {
                    background: rgba(6, 182, 212, 0.3);
                    border: 1px solid rgba(6, 182, 212, 0.6);
                    transform: scale(1.02);
                }

                .hex-send-button-editor:disabled {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.3);
                    opacity: 0.5;
                }

                .hex-avatar {
                    -webkit-backdrop-filter: blur(8px);
                    backdrop-filter: blur(8px);
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    border-radius: 50%;
                    padding: 6px;
                    margin-bottom: 8px;
                    flex-shrink: 0;
                }

                .hex-avatar-user {
                    background: rgba(6, 182, 212, 0.3);
                    border: 1px solid rgba(6, 182, 212, 0.6);
                }

                .hex-avatar-ai {
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                }

                .hex-content {
                    text-align: left;
                    width: 100%;
                    max-width: 180px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    max-height: 200px;
                    padding-right: 4px;
                }

                .hex-content::-webkit-scrollbar {
                    width: 3px;
                }

                .hex-content::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 2px;
                }

                .hex-content::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 2px;
                }

                .hex-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .hex-text {
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 8px;
                    line-height: 1.4;
                    font-weight: 300;
                    margin-bottom: 6px;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    hyphens: auto;
                    flex: 1;
                }

                .selectable-text {
                    user-select: none;
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                }

                .hex-message.in-locked-mode .selectable-text {
                    user-select: text;
                    -webkit-user-select: text;
                    -moz-user-select: text;
                    -ms-user-select: text;
                }

                .hex-message {
                    /* ... existing styles ... */
                    cursor: pointer;
                }

                .selectable-text::selection {
                    background: rgba(6, 182, 212, 0.3);
                    color: white;
                }

                .selectable-text::-moz-selection {
                    background: rgba(6, 182, 212, 0.3);
                    color: white;
                }

                .hex-text strong {
                    color: rgba(255, 255, 255, 1);
                    font-weight: 600;
                }

                .hex-text em {
                    color: rgba(6, 182, 212, 0.9);
                    font-style: italic;
                }

                .hex-text code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 1px 3px;
                    font-family: monospace;
                    font-size: 9px;
                    color: rgba(34, 197, 94, 0.9);
                }

                .hex-text li {
                    margin-left: 8px;
                    list-style: none;
                    position: relative;
                }

                .hex-text li:before {
                    content: "•";
                    color: rgba(6, 182, 212, 0.8);
                    margin-right: 4px;
                }

                .hex-timestamp {
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 8px;
                    font-family: monospace;
                    letter-spacing: 0.5px;
                    margin-top: auto;
                    flex-shrink: 0;
                    margin-bottom: 6px;
                }

                .hex-message-actions {
                    display: flex;
                    gap: 2px;
                    justify-content: flex-end;
                    margin-top: 4px;
                }

                .hex-action-button {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: rgba(255, 255, 255, 0.6);
                    padding: 2px;
                    font-size: 6px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .hex-action-button:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    color: rgba(255, 255, 255, 0.9);
                    transform: scale(1.05);
                }

                .hex-action-button.copy {
                    color: rgba(34, 197, 94, 0.8);
                    border-color: rgba(34, 197, 94, 0.3);
                }

                .hex-action-button.copy:hover {
                    background: rgba(34, 197, 94, 0.1);
                    color: rgba(34, 197, 94, 1);
                    border-color: rgba(34, 197, 94, 0.5);
                }

                .hex-action-button.rerun {
                    color: rgba(6, 182, 212, 0.8);
                    border-color: rgba(6, 182, 212, 0.3);
                }

                .hex-action-button.rerun:hover {
                    background: rgba(6, 182, 212, 0.1);
                    color: rgba(6, 182, 212, 1);
                    border-color: rgba(6, 182, 212, 0.5);
                }

                .hex-action-button.branch {
                    color: rgba(147, 51, 234, 0.8);
                    border-color: rgba(147, 51, 234, 0.3);
                }

                .hex-action-button.branch:hover {
                    background: rgba(147, 51, 234, 0.1);
                    color: rgba(147, 51, 234, 1);
                    border-color: rgba(147, 51, 234, 0.5);
                }

                /* Glass Panel Styles */
                .glass-panel {
                    -webkit-backdrop-filter: blur(10px);
                    backdrop-filter: blur(10px);
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    padding: 16px 24px;
                }

                .glass-panel-slim {
                    -webkit-backdrop-filter: blur(10px);
                    backdrop-filter: blur(10px);
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    padding: 16px 12px;
                }

                .zoom-slider-horizontal {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 120px;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    outline: none;
                }

                .zoom-slider-horizontal::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    background: rgba(6, 182, 212, 0.8);
                    border: 2px solid rgba(6, 182, 212, 1);
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.4);
                    transition: all 0.2s ease;
                }

                .zoom-slider-horizontal::-webkit-slider-thumb:hover {
                    background: rgba(6, 182, 212, 1);
                    transform: scale(1.2);
                    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.6);
                }

                .zoom-slider-horizontal::-moz-range-thumb {
                    width: 12px;
                    height: 12px;
                    background: rgba(6, 182, 212, 0.8);
                    border: 2px solid rgba(6, 182, 212, 1);
                    cursor: pointer;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.4);
                }

                .glass-control-button {
                    -webkit-backdrop-filter: blur(8px);
                    backdrop-filter: blur(8px);
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                    color: white;
                    padding: 12px;
                    transition: all 0.2s ease;
                }

                .glass-control-button:hover {
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    transform: scale(1.05);
                }

                .glass-control-button.exit-button {
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.5);
                    color: rgba(239, 68, 68, 1);
                }

                .glass-control-button.exit-button:hover {
                    background: rgba(239, 68, 68, 0.3);
                    border: 1px solid rgba(239, 68, 68, 0.7);
                    transform: scale(1.1);
                }

                /* Animations */
                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .animate-fade-in {
                    animation: fade-in 0.6s ease-out forwards;
                }

                /* Prevent text selection while dragging */
                .cursor-grab {
                    user-select: none;
                }

                .cursor-grab:active:not(.selectable-text):not(.hex-rich-input-editor) {
                    cursor: grabbing !important;
                }
            `}</style>
        </div>
    );
};

export default HexagonalMessageGrid;