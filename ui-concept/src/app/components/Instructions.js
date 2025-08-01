import React from 'react';

const Instructions = ({ isLocked }) => {
    return (
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
    );
};

export default Instructions;