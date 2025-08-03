"use client";

import React from 'react';
import ContextMenu from '../ContextMenu';
import IframeModal from '../IframeModal';
import GiantHexagon from '../GiantHexagon';
import GiantWebsite from '../GiantWebsite';
import GiantInput from '../GiantInput';

const ModalContainer = ({
    contextMenuState,
    showIframeModal,
    expandingMessage,
    expandingWebsite,
    expandingInput,
    canStartNewChat,
    inputText,
    setInputText,
    handleCloseContextMenu,
    startNewChat,
    handleOpenIframeModal,
    handleCloseIframeModal,
    handleCreateWebsite,
    handleCloseExpanded,
    handleRemoveWebsite,
    handleSend,
    renderMarkdown
}) => {
    return (
        <>
            {/* Context Menu */}
            <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 200, pointerEvents: 'none' }}>
                <div style={{ pointerEvents: 'auto' }}>
                    <ContextMenu
                        x={contextMenuState.position?.x || 0}
                        y={contextMenuState.position?.y || 0}
                        visible={contextMenuState.isOpen}
                        onClose={handleCloseContextMenu}
                        canStartNewChat={canStartNewChat}
                        onStartNewChat={startNewChat}
                        onOpenIframeModal={handleOpenIframeModal}
                    />
                </div>
            </div>
            
            {/* Iframe Modal */}
            <IframeModal 
                isOpen={showIframeModal} 
                onClose={handleCloseIframeModal}
                onCreateWebsite={handleCreateWebsite}
            />
            
            {/* Giant Hexagon Expansion */}
            {expandingMessage && (
                <GiantHexagon
                    message={expandingMessage.message}
                    onClose={handleCloseExpanded}
                    renderMarkdown={renderMarkdown}
                />
            )}
            
            {/* Giant Website Expansion */}
            {expandingWebsite && (
                <GiantWebsite
                    website={expandingWebsite.website}
                    onClose={handleCloseExpanded}
                    onRemoveWebsite={handleRemoveWebsite}
                />
            )}
            
            {/* Giant Input Expansion */}
            {expandingInput && (
                <GiantInput
                    inputText={inputText}
                    onInputChange={setInputText}
                    onSendMessage={handleSend}
                    onClose={handleCloseExpanded}
                />
            )}
        </>
    );
};

export default ModalContainer;