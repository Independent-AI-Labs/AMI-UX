import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const CompactModal = ({ 
    isOpen, 
    onClose, 
    message, 
    type = 'info', // 'info', 'warning', 'error'
    confirmText = 'OK',
    cancelText = 'Cancel',
    onConfirm,
    showCancel = true,
    children // For custom content
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    const handleClose = () => {
        setIsClosing(true);
        setIsVisible(false);
        
        setTimeout(() => {
            setIsClosing(false);
            if (onClose) onClose();
        }, 150);
    };

    const handleConfirm = () => {
        setIsClosing(true);
        setIsVisible(false);
        
        setTimeout(() => {
            setIsClosing(false);
            if (onConfirm) onConfirm();
            if (onClose) onClose();
        }, 150);
    };

    if (!isOpen && !isClosing) return null;

    const getTypeStyles = () => {
        switch (type) {
            case 'warning':
                return {
                    background: 'rgba(251, 146, 60, 0.95)',
                    buttonColor: 'rgba(254, 215, 170, 1)',
                    buttonHoverColor: 'rgba(254, 243, 199, 1)',
                    textColor: 'rgba(255, 255, 255, 0.95)'
                };
            case 'error':
                return {
                    background: 'rgba(239, 68, 68, 0.95)',
                    buttonColor: 'rgba(252, 165, 165, 1)',
                    buttonHoverColor: 'rgba(254, 202, 202, 1)',
                    textColor: 'rgba(255, 255, 255, 0.95)'
                };
            default: // info
                return {
                    background: 'rgba(255, 255, 255, 0.95)',
                    buttonColor: 'rgba(229, 231, 235, 1)',
                    buttonHoverColor: 'rgba(209, 213, 219, 1)',
                    textColor: 'rgba(0, 0, 0, 0.9)'
                };
        }
    };

    const styles = getTypeStyles();

    // Use portal to render at document body for proper centering
    const modalContent = (
        <>
            {/* Background overlay */}
            <div
                className="compact-modal-overlay"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999,
                    opacity: isVisible && !isClosing ? 1 : 0,
                    transition: 'opacity 0.15s ease'
                }}
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                className="compact-modal"
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: styles.background,
                    backdropFilter: 'blur(20px)',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    minWidth: '18.75rem',
                    maxWidth: '25rem',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                    zIndex: 10000,
                    opacity: isVisible && !isClosing ? 1 : 0,
                    filter: isVisible && !isClosing ? 'blur(0px)' : 'blur(10px)',
                    transition: 'opacity 0.15s ease, filter 0.15s ease',
                    color: styles.textColor,
                    // Ensure modal is always centered in the actual viewport
                    margin: 0,
                    maxHeight: '90vh',
                    overflow: 'auto'
                }}
            >
                {/* Message or custom content */}
                {children || (
                    <div style={{ 
                        marginBottom: '1.25rem',
                        fontSize: '1rem',
                        lineHeight: '1.5',
                        textAlign: 'center'
                    }}>
                        {message}
                    </div>
                )}

                {/* Buttons */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'center'
                }}>
                    {showCancel && (
                        <button
                            onClick={handleClose}
                            className="compact-modal-button"
                            style={{
                                background: 'rgba(0, 0, 0, 0.1)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                color: styles.textColor
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(0, 0, 0, 0.2)';
                                e.target.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'rgba(0, 0, 0, 0.1)';
                                e.target.style.transform = 'scale(1)';
                            }}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className="compact-modal-button primary"
                        style={{
                            background: styles.buttonColor,
                            border: 'none',
                            borderRadius: '0.5rem',
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            color: type === 'info' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = styles.buttonHoverColor;
                            e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = styles.buttonColor;
                            e.target.style.transform = 'scale(1)';
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </>
    );

    // Only render portal in browser environment
    if (typeof window === 'undefined') return null;

    return createPortal(modalContent, document.body);
};

export default CompactModal;