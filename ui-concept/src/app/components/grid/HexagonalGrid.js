"use client";

import React, { useRef, useState, useCallback, useMemo } from 'react';
import GridSelection from '../GridSelection';
import HexMessage from '../HexMessage';
import HexWebsite from '../HexWebsite';
import TypingIndicator from '../TypingIndicator';
import HexInput from '../HexInput';
import AnimatedUITile from '../AnimatedUITile';

const HexagonalGrid = ({
    messages,
    websites,
    isTyping,
    viewState,
    hexSize,
    gridSelection,
    conversationState,
    inputState,
    lockedWebsiteId,
    dragRef,
    dragGhost,
    websiteHover,
    lodState,
    hexToPixel,
    pixelToHex,
    getInputPosition,
    getMessagePosition,
    lockToConversation,
    handleExpandMessage,
    handleCloseExpanded,
    handleCopyMessage,
    renderMarkdownMemo,
    handleLockToWebsite,
    handleRemoveWebsite,
    handleUpdateWebsiteUrl,
    handleMoveWebsite,
    handleExpandWebsite,
    setDragGhost,
    setWebsiteHover,
    containerRef,
    inputRef,
    inputText,
    setInputText,
    handleSend,
    handleExpandInput,
    setHoveredMessageId,
    markdownRenderKey
}) => {
    // Content layer - handles its own interactions
    return (
        <div
            className="absolute inset-0"
            style={{
                // Let individual elements handle pointer events
                pointerEvents: 'none',
                zIndex: 10 // Ensure content is above background grid dots
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
                let position;
                if (message.q !== undefined && message.r !== undefined) {
                    position = { q: message.q, r: message.r };
                } else {
                    position = getMessagePosition(message, index);
                }
                
                const pixelPosition = hexToPixel(position.q, position.r);

                return (
                    <HexMessage
                        key={message.id}
                        message={message}
                        position={{ ...position, ...pixelPosition }}
                        hexSize={hexSize}
                        isLocked={conversationState.isConversationMode}
                        dragRef={dragRef}
                        onLockToConversation={(q, r) => lockToConversation(q, r, message.id)}
                        onExpandMessage={handleExpandMessage}
                        onCloseExpanded={handleCloseExpanded}
                        onCopyMessage={handleCopyMessage}
                        renderMarkdown={renderMarkdownMemo}
                        index={index}
                        zoom={viewState.zoom}
                        lodState={lodState}
                        onMouseEnter={() => setHoveredMessageId(message.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                        markdownRenderKey={markdownRenderKey}
                    />
                );
            })}

            {/* Website Tiles */}
            {websites.map((website, index) => {
                const position = { q: website.q, r: website.r };
                const pixelPosition = hexToPixel(position.q, position.r);

                return (
                    <HexWebsite
                        key={website.id}
                        website={website}
                        position={{ ...position, ...pixelPosition }}
                        hexSize={hexSize}
                        isLocked={conversationState.isConversationMode}
                        isWebsiteLocked={conversationState.isWebsiteMode && conversationState.lockedTarget === website.id}
                        dragRef={dragRef}
                        onLockToConversation={() => {/* Websites don't lock to conversations */}}
                        onLockToWebsite={handleLockToWebsite}
                        onRemoveWebsite={handleRemoveWebsite}
                        onUpdateWebsiteUrl={handleUpdateWebsiteUrl}
                        onMoveWebsite={handleMoveWebsite}
                        onExpandWebsite={handleExpandWebsite}
                        onDragStart={(website) => setDragGhost({ visible: true, website })}
                        onDragEnd={() => setDragGhost({ visible: false, website: null })}
                        onHoverChange={(websiteId, isHovered, hoverData) => {
                            if (isHovered) {
                                const rect = containerRef.current?.getBoundingClientRect();
                                if (rect && hoverData) {
                                    const screenX = rect.left + viewState.x + (hoverData.x + hoverData.hexSize * 0.5) * viewState.zoom;
                                    const screenY = rect.top + viewState.y + (hoverData.y - 30) * viewState.zoom;
                                    setWebsiteHover({ 
                                        visible: true, 
                                        websiteId, 
                                        position: { x: screenX, y: screenY },
                                        onDragStart: hoverData.onDragStart
                                    });
                                }
                            } else {
                                setWebsiteHover({ visible: false, websiteId: null, position: null, onDragStart: null });
                            }
                        }}
                        pixelToHex={pixelToHex}
                        viewState={viewState}
                        containerRef={containerRef}
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
                isVisible={!isTyping && conversationState.isConversationMode}
                tileType="input"
                delay={100}
            >
                {!isTyping && conversationState.isConversationMode && (() => {
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
                            onExpandInput={handleExpandInput}
                            isLocked={conversationState.isConversationMode}
                            zoom={viewState.zoom}
                            lodState={lodState}
                        />
                    );
                })()}
            </AnimatedUITile>
        </div>
    );
};

export default HexagonalGrid;