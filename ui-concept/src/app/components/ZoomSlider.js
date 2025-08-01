import React from 'react';

const ZoomSlider = ({ viewState, onZoomSliderChange }) => {
    return (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="glass-panel-slim flex items-center space-x-4">
                <div className="text-white/60 text-xs font-mono tracking-wider">
                    ZOOM
                </div>
                <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={viewState.zoom}
                    onChange={onZoomSliderChange}
                    className="zoom-slider-horizontal"
                />
                <div className="text-white/40 text-xs font-mono">
                    {Math.round(viewState.zoom * 100)}%
                </div>
            </div>
        </div>
    );
};

export default ZoomSlider;