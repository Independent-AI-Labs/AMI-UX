import React, { useState, useEffect, useRef } from 'react';

/**
 * AnimatedUITile - Wrapper component that adds smooth in/out animations to UI tiles
 */
const AnimatedUITile = ({ 
    children, 
    isVisible, 
    tileType = 'ui', // 'ui', 'input', 'typing'
    onAnimationComplete,
    delay = 0 
}) => {
    const [animationState, setAnimationState] = useState('hidden'); // 'hidden', 'entering', 'visible', 'exiting'
    const [shouldRender, setShouldRender] = useState(isVisible);
    const elementRef = useRef(null);
    const timeoutRef = useRef(null);

    // Determine animation classes based on tile type
    const getAnimationClasses = (state) => {
        const baseClass = 'ui-tile-animate';
        
        switch (tileType) {
            case 'input':
                return {
                    entering: `${baseClass} input-tile-enter`,
                    exiting: `${baseClass} input-tile-exit`
                };
            case 'typing':
                return {
                    entering: `${baseClass} typing-tile-enter`,
                    exiting: `${baseClass} typing-tile-exit`
                };
            default:
                return {
                    entering: `${baseClass} ui-tile-enter`,
                    exiting: `${baseClass} ui-tile-exit`
                };
        }
    };

    const animationClasses = getAnimationClasses();

    // Handle visibility changes
    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (isVisible && animationState === 'hidden') {
            // Start enter animation
            setShouldRender(true);
            
            timeoutRef.current = setTimeout(() => {
                setAnimationState('entering');
            }, delay);
            
        } else if (!isVisible && (animationState === 'visible' || animationState === 'entering')) {
            // Start exit animation
            setAnimationState('exiting');
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [isVisible, animationState, delay]);

    // Handle animation end events
    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const handleAnimationEnd = (event) => {
            if (event.target !== element) return; // Only handle events from this element

            if (animationState === 'entering') {
                setAnimationState('visible');
                if (onAnimationComplete) {
                    onAnimationComplete('enter');
                }
            } else if (animationState === 'exiting') {
                setAnimationState('hidden');
                setShouldRender(false);
                if (onAnimationComplete) {
                    onAnimationComplete('exit');
                }
            }
        };

        element.addEventListener('animationend', handleAnimationEnd);
        
        return () => {
            element.removeEventListener('animationend', handleAnimationEnd);
        };
    }, [animationState, onAnimationComplete]);

    // Don't render if not visible and not animating
    if (!shouldRender) {
        return null;
    }

    // Determine current class
    const getCurrentClass = () => {
        switch (animationState) {
            case 'entering':
                return animationClasses.entering;
            case 'exiting':
                return animationClasses.exiting;
            case 'visible':
                return 'ui-tile-animate animation-complete';
            default:
                return '';
        }
    };

    return (
        <div 
            ref={elementRef}
            className={getCurrentClass()}
            style={{
                opacity: animationState === 'hidden' ? 0 : undefined
            }}
        >
            {children}
        </div>
    );
};

export default AnimatedUITile;