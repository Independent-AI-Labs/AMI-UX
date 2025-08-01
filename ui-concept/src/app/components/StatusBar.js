import React, { useState, useEffect } from 'react';

const StatusBar = ({ hasActiveToast = false }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Auto-expand when there's an active toast, collapse when toast disappears
    useEffect(() => {
        if (hasActiveToast) {
            setIsExpanded(true);
        } else {
            setIsExpanded(false);
        }
    }, [hasActiveToast]);

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }).toUpperCase();
    };

    const handleMouseEnter = () => {
        setIsExpanded(true);
    };

    const handleMouseLeave = () => {
        if (!hasActiveToast) {
            setIsExpanded(false);
        }
    };

    return (
        <div 
            className={`status-bar ${isExpanded ? 'expanded' : 'compact'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="status-bar-content">
                {/* Left: Clock and Date */}
                <div className="status-left">
                    <div className="status-time">{formatTime(currentTime)}</div>
                    {isExpanded && (
                        <div className="status-date">{formatDate(currentTime)}</div>
                    )}
                </div>
                
                {/* Middle: Reserved for toasts */}
                <div className="status-middle">
                    {/* This space is reserved for error toasts */}
                </div>
                
                {/* Right: Empty for future use */}
                <div className="status-right">
                    {/* Reserved for future features */}
                </div>
            </div>
        </div>
    );
};

export default StatusBar;