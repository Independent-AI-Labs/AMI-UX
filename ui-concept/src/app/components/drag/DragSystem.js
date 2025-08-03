"use client";

import React from 'react';
import DragGhost from '../DragGhost';

const DragSystem = ({ 
    dragGhost, 
    websiteHover, 
    hexSize 
}) => {
    return (
        <>
            {/* Global Drag Ghost */}
            <DragGhost
                website={dragGhost.website}
                isVisible={dragGhost.visible}
                hexSize={hexSize}
            />
            
            {/* External Drag Handle */}
            {websiteHover.visible && websiteHover.position && (
                <div
                    className="website-drag-handle"
                    style={{
                        position: 'fixed',
                        left: websiteHover.position.x - 12,
                        top: websiteHover.position.y - 12,
                        zIndex: 1000,
                        pointerEvents: 'auto'
                    }}
                >
                    <button
                        onMouseDown={websiteHover.onDragStart}
                        onDragStart={(e) => e.preventDefault()}
                        className="hex-website-action-button hex-website-drag"
                        title="Drag to move"
                        draggable={false}
                        style={{
                            background: 'rgba(255, 255, 255, 0.9)',
                            color: '#4a4a4a',
                            border: '1px solid rgba(0, 0, 0, 0.2)',
                            borderRadius: '0.25rem',
                            padding: '6px 12px',
                            cursor: dragGhost.visible ? 'grabbing' : 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '2rem',
                            minHeight: '1.25rem',
                            transition: 'all 0.2s ease',
                            transform: 'rotate(90deg)',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            MozUserSelect: 'none',
                            msUserSelect: 'none'
                        }}
                    >
                        ⋮⋮
                    </button>
                </div>
            )}
        </>
    );
};

export default DragSystem;