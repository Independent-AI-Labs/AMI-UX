import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';

const ChatPanel = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState([
        { id: 1, text: "Hello! How can I help you today?", sender: 'ai', timestamp: new Date() },
        { id: 2, text: "I need help understanding the hex grid system", sender: 'user', timestamp: new Date() },
        { id: 3, text: "The hex grid system allows you to organize content in a visually appealing hexagonal layout. Each hex can contain messages, websites, or other content types. You can click on hexes to focus on conversations or drag to navigate around.", sender: 'ai', timestamp: new Date() }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);
    
    // Handle ESC key
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isOpen, onClose]);

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
        setIsTyping(true);

        // Simulate AI response
        setTimeout(() => {
            const aiResponse = {
                id: Date.now() + 1,
                text: "I understand your question. Let me help you with that...",
                sender: 'ai',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiResponse]);
            setIsTyping(false);
        }, 1500);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div 
            className={`chat-panel ${isOpen ? 'open' : ''}`}
            style={{
                position: 'fixed',
                left: 0,
                top: '60px', // Leave space for status bar
                width: '40%',
                height: 'calc(100vh - 160px)', // Leave space for status bar (60px) and bottom bar (100px)
                background: 'rgba(255, 255, 255, 0.05)',
                zIndex: 40, // Below status bar (50) and bottom bar (50)
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0 20px 20px 0',
                boxShadow: isOpen ? '0 0 50px rgba(0, 0, 0, 0.1)' : 'none',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                filter: isOpen ? 'blur(0)' : 'blur(8px)',
                backdropFilter: isOpen ? 'blur(20px) saturate(180%)' : 'blur(0px)',
                WebkitBackdropFilter: isOpen ? 'blur(20px) saturate(180%)' : 'blur(0px)',
                animation: isOpen ? 'panelFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' : '',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '24px 32px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
            }}>
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)',
                    margin: 0,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}>Chat Assistant</h2>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                    }}
                >
                    <X size={24} color="rgba(255, 255, 255, 0.6)" />
                </button>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            }}>
                {messages.map((message) => (
                    <div
                        key={message.id}
                        style={{
                            display: 'flex',
                            justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                            animation: 'messageSlideIn 0.3s ease-out',
                        }}
                    >
                        <div style={{
                            maxWidth: '70%',
                            padding: '16px 20px',
                            borderRadius: '20px',
                            background: message.sender === 'user' 
                                ? 'rgba(220, 235, 255, 0.9)' 
                                : 'rgba(255, 255, 255, 0.9)',
                            color: 'rgba(0, 0, 0, 0.9)',
                            fontSize: '15px',
                            lineHeight: '1.5',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                        }}>
                            {message.text}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        animation: 'messageSlideIn 0.3s ease-out',
                    }}>
                        <div style={{
                            padding: '16px 20px',
                            borderRadius: '20px',
                            background: 'rgba(255, 255, 255, 0.9)',
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                        }}>
                            <div className="typing-dot" style={{ animationDelay: '0ms' }} />
                            <div className="typing-dot" style={{ animationDelay: '150ms' }} />
                            <div className="typing-dot" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.02)',
            }}>
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-end',
                }}>
                    <textarea
                        ref={inputRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        style={{
                            flex: 1,
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '24px',
                            padding: '12px 20px',
                            fontSize: '15px',
                            color: 'rgba(255, 255, 255, 0.9)',
                            resize: 'none',
                            outline: 'none',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                            minHeight: '48px',
                            maxHeight: '120px',
                            transition: 'all 0.2s ease',
                        }}
                        onFocus={(e) => {
                            e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                        }}
                        onBlur={(e) => {
                            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: inputText.trim() 
                                ? 'rgba(255, 255, 255, 0.9)' 
                                : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            transform: 'scale(1)',
                        }}
                        onMouseEnter={(e) => {
                            if (inputText.trim()) {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <Send 
                            size={20} 
                            color={inputText.trim() ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.3)'} 
                        />
                    </button>
                </div>
            </div>

            <style jsx>{`
                @keyframes messageSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .typing-dot {
                    width: 8px;
                    height: 8px;
                    background: rgba(0, 0, 0, 0.4);
                    border-radius: 50%;
                    animation: typing 1.4s ease-in-out infinite;
                }

                @keyframes typing {
                    0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: 0.4;
                    }
                    30% {
                        transform: translateY(-10px);
                        opacity: 1;
                    }
                }

                textarea::-webkit-placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }
                textarea::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }

                @keyframes panelFadeIn {
                    0% {
                        opacity: 0;
                        filter: blur(8px);
                    }
                    60% {
                        opacity: 0.5;
                        filter: blur(4px);
                    }
                    100% {
                        opacity: 1;
                        filter: blur(0);
                    }
                }
                
                @keyframes panelFadeOut {
                    from {
                        opacity: 1;
                        filter: blur(0);
                    }
                    to {
                        opacity: 0;
                        filter: blur(8px);
                    }
                }
            `}</style>
        </div>
    );
};

export default ChatPanel;