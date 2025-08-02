import React from 'react';
import { Plus, Minus, RotateCcw, X } from 'lucide-react';

const Controls = ({ 
    isLocked, 
    isWebsiteLocked,
    viewState, 
    screenCenter, 
    animationManager, 
    onExitLocked, 
    onExitWebsiteLocked,
    onResetView 
}) => {
    const handleZoomIn = () => {
        animationManager.current.setZoom(Math.min(3.0, viewState.zoom * 1.25), screenCenter.x, screenCenter.y, screenCenter);
    };

    const handleZoomOut = () => {
        animationManager.current.setZoom(Math.max(0.4, viewState.zoom * 0.8), screenCenter.x, screenCenter.y, screenCenter);
    };

    return (
        <div className="absolute top-24 right-6 z-50 flex flex-col space-y-2">
            {isLocked && (
                <button
                    onClick={onExitLocked}
                    className="glass-control-button exit-button"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
            {isWebsiteLocked && (
                <button
                    onClick={onExitWebsiteLocked}
                    className="glass-control-button exit-button website-locked"
                    title="Exit website view"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
            {!isLocked && !isWebsiteLocked && (
                <>
                    <button
                        onClick={handleZoomIn}
                        className="glass-control-button"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="glass-control-button"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={onResetView} className="glass-control-button">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );
};

export default Controls;