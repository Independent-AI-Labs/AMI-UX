/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 */
export function throttle(func, wait) {
    let timeout;
    let lastTime = 0;
    
    return function throttled(...args) {
        const now = Date.now();
        const remaining = wait - (now - lastTime);
        
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            lastTime = now;
            func.apply(this, args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                lastTime = Date.now();
                timeout = null;
                func.apply(this, args);
            }, remaining);
        }
    };
}

/**
 * Creates a throttled function using requestAnimationFrame for smooth 60fps updates
 */
export function throttleRAF(func) {
    let rafId = null;
    let lastArgs = null;
    
    const throttled = function(...args) {
        lastArgs = args;
        
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                func.apply(this, lastArgs);
                rafId = null;
            });
        }
    };
    
    throttled.cancel = () => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };
    
    return throttled;
}