/**
 * LoD-aware component wrapper that applies styling based on current LoD state
 */
import React from 'react';
import lodManager from '../lodManager';

// Dynamic CSS class generator based on LoD state
export const generateLoDStyles = (lodState, hexType = 'message') => {
    if (!lodState) return {};
    
    const transparency = lodState.styling.transparency[hexType];
    if (!transparency) return {};
    
    return {
        '--hex-bg-base': `rgba(255, 255, 255, ${transparency.base})`,
        '--hex-bg-hover': `rgba(255, 255, 255, ${transparency.hover})`,
        '--hex-bg-locked': `rgba(255, 255, 255, ${transparency.locked})`,
        '--animation-speed': lodState.styling.animationSpeed || 1.0
    };
};

// LoD-aware hex wrapper component
export const LoDHexWrapper = ({ children, lodState, hexType = 'message', className = '', useScreenBlend = false, ...props }) => {
    const styles = generateLoDStyles(lodState, hexType);
    
    // Only wrap with blend container if explicitly requested
    if (useScreenBlend) {
        return (
            <div 
                className="hex-blend-container"
                style={{ mixBlendMode: 'screen' }}
            >
                <div 
                    className={`lod-hex-wrapper ${className}`}
                    style={styles}
                    {...props}
                >
                    {children}
                </div>
            </div>
        );
    }
    
    // Default: no blend mode wrapper
    return (
        <div 
            className={`lod-hex-wrapper ${className}`}
            style={styles}
            {...props}
        >
            {children}
        </div>
    );
};

// Hook to get current LoD capabilities
export const useLoDCapabilities = () => {
    const [capabilities, setCapabilities] = React.useState(null);
    
    React.useEffect(() => {
        const updateCapabilities = (state) => {
            setCapabilities(state.capabilities);
        };
        
        // Get initial state
        const currentState = lodManager.getCurrentState();
        setCapabilities(currentState.capabilities);
        
        // Subscribe to changes (simplified - in real app would use proper event system)
        const interval = setInterval(() => {
            const state = lodManager.getCurrentState();
            setCapabilities(state.capabilities);
        }, 100);
        
        return () => clearInterval(interval);
    }, []);
    
    return capabilities;
};

export default { generateLoDStyles, LoDHexWrapper, useLoDCapabilities };