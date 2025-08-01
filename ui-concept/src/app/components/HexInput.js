import React from 'react';
import { Bold, Italic, Code, Send, Paperclip } from 'lucide-react';
import Hexagon from './Hexagon';
import HexInputLoD from './HexInputLoD';

const HexInput = React.memo(({ 
    position, 
    hexSize, 
    inputRef, 
    inputText, 
    onInputChange, 
    onSend, 
    isLocked,
    zoom 
}) => {
    const { x, y } = position;

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
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
    };

    const handleWheel = (e) => {
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
    };

    const handleFormatButton = (command, e) => {
        e.preventDefault();
        if (command === 'code') {
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
        } else {
            document.execCommand(command);
        }
        inputRef.current?.focus();
    };

    // Use Level of Detail when zoom is below 80%
    const useLoD = zoom < 0.8;

    return (
        <Hexagon
            q={position.q}
            r={position.r}
            x={x}
            y={y}
            hexSize={hexSize}
        >
            {useLoD ? (
                <HexInputLoD />
            ) : (
                <div className="hex-input-message-editor">
                    {/* Formatting Controls */}
                    <div className="hex-editor-toolbar">
                        <button
                            onMouseDown={(e) => handleFormatButton('bold', e)}
                            className="hex-format-button"
                            title="Bold (Ctrl+B)"
                        >
                            <Bold className="w-2 h-2" />
                        </button>
                        <button
                            onMouseDown={(e) => handleFormatButton('italic', e)}
                            className="hex-format-button"
                            title="Italic (Ctrl+I)"
                        >
                            <Italic className="w-2 h-2" />
                        </button>
                        <button
                            onMouseDown={(e) => handleFormatButton('code', e)}
                            className="hex-format-button"
                            title="Code"
                        >
                            <Code className="w-2 h-2" />
                        </button>
                    </div>

                    {/* Rich Text Input */}
                    <div
                        ref={inputRef}
                        contentEditable
                        suppressContentEditableWarning={true}
                        className="hex-rich-input-editor"
                        onInput={(e) => onInputChange(e.target.textContent || '')}
                        onKeyDown={handleKeyDown}
                        onWheel={handleWheel}
                        data-placeholder="Continue thread..."
                    />

                    {/* Send Button Row */}
                    <div className="hex-button-row">
                        <button
                            className="hex-attach-button"
                            title="Attach file"
                        >
                            <Paperclip className="w-2 h-2" />
                        </button>
                        <button
                            onClick={onSend}
                            disabled={!inputText.trim()}
                            className="hex-send-button-editor"
                        >
                            <Send className="w-2 h-2 mr-1" />
                            Send
                        </button>
                    </div>
                </div>
            )}
        </Hexagon>
    );
});

HexInput.displayName = 'HexInput';

export default HexInput;