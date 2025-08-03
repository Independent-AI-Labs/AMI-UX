import React from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import Hexagon from './Hexagon';

const DragGhost = ({ website, isVisible, hexSize }) => {
    if (!isVisible || !website) return null;

    const ghostContent = (
        <div 
            className="drag-ghost"
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                zIndex: 10000, // Higher than everything
                opacity: 0.7,
                transform: `translate(calc(var(--mouse-x, 0px) - ${hexSize * 0.5}px), calc(var(--mouse-y, 0px) - ${hexSize * 0.5}px)) scale(0.5)`
            }}
        >
            <Hexagon
                q={0}
                r={0}
                x={0}
                y={0}
                hexSize={hexSize}
                hexId="drag-ghost"
            >
                <div 
                    className="hex-website drag-ghost-content"
                    style={{
                        width: '100%',
                        height: '100%',
                        background: 'rgba(255, 255, 255, 0.95)',
                        border: '2px dashed rgba(59, 130, 246, 0.8)',
                        borderRadius: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                        fontFamily: 'Montserrat, sans-serif'
                    }}
                >
                    {/* Website LoD placeholder */}
                    <div className="hex-website-placeholder">
                        <ExternalLink className="w-12 h-12" />
                        <div className="hex-placeholder-lines">
                            <div className="hex-placeholder-line hex-placeholder-line-1"></div>
                            <div className="hex-placeholder-line hex-placeholder-line-2"></div>
                        </div>
                    </div>
                </div>
            </Hexagon>
        </div>
    );

    // Render to document body to escape all transforms and zoom
    return createPortal(ghostContent, document.body);
};

export default DragGhost;