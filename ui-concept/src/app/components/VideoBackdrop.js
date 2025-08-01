import React, { useRef, useEffect, useMemo } from 'react';

const VideoBackdrop = ({ viewState, screenCenter }) => {
    const videoRef = useRef(null);
    
    // Calculate parallax transform based on view state
    const parallaxStyle = useMemo(() => {
        const { x, y, zoom } = viewState;
        
        // Much smaller parallax factors for subtle movement
        const parallaxFactorX = 0.1;
        const parallaxFactorY = 0.04;
        const zoomFactor = 0.2; // 20% of canvas zoom (much smaller)
        
        // Calculate video transform with initial coordinate correction
        // Add percentage-based offset to center video relative to grid
        const offsetX = typeof window !== 'undefined' ? -window.innerWidth * 0.05 : 0;
        const offsetY = typeof window !== 'undefined' ? -window.innerHeight * 0.025 : 0;
        
        const videoX = x * parallaxFactorX + offsetX;
        const videoY = y * parallaxFactorY + offsetY;
        const videoZoom = 1.2 + (zoom - 1) * zoomFactor; // Start at 120% with smaller zoom factor
        
        return {
            transform: `translate(-50%, -50%) translate(${videoX}px, ${videoY}px) scale(${videoZoom})`,
            transformOrigin: 'center center',
        };
    }, [viewState]);

    // Handle video playback
    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            console.log('Video element found, attempting to play...');
            console.log('Video src:', video.src || video.currentSrc);
            
            // Set video properties for better autoplay compatibility
            video.muted = true;
            video.playsInline = true;
            video.loop = true;
            video.playbackRate = 0.5; // Slow down to 50% speed
            
            // Add event listeners for debugging and auto-play
            const handleVideoEvent = (eventName) => (e) => {
                console.log(`Video ${eventName}:`, e);
                if (eventName === 'loadedmetadata') {
                    console.log('Video duration:', video.duration);
                    console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
                }
                if (eventName === 'canplay' || eventName === 'canplaythrough') {
                    // Force play when video is ready
                    if (video.paused) {
                        console.log('Video is ready, forcing play...');
                        video.play().then(() => {
                            console.log('Video forced to play successfully');
                        }).catch(err => {
                            console.error('Failed to force play:', err);
                        });
                    }
                }
            };
            
            ['loadstart', 'loadedmetadata', 'canplay', 'canplaythrough', 'play', 'pause', 'ended', 'error'].forEach(event => {
                video.addEventListener(event, handleVideoEvent(event));
            });
            
            // Try to play after a short delay
            const timer = setTimeout(() => {
                const playPromise = video.play();
                
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('Video is playing successfully');
                        })
                        .catch(error => {
                            console.error('Video autoplay failed:', error);
                            
                            // Fallback: try to play on user interaction
                            const tryPlayOnInteraction = () => {
                                video.play().then(() => {
                                    console.log('Video started playing after user interaction');
                                    document.removeEventListener('click', tryPlayOnInteraction);
                                    document.removeEventListener('touchstart', tryPlayOnInteraction);
                                }).catch(e => console.error('Still failed to play:', e));
                            };
                            
                            document.addEventListener('click', tryPlayOnInteraction);
                            document.addEventListener('touchstart', tryPlayOnInteraction);
                        });
                }
            }, 100);
            
            return () => {
                clearTimeout(timer);
                ['loadstart', 'loadedmetadata', 'canplay', 'canplaythrough', 'play', 'pause', 'ended', 'error'].forEach(event => {
                    video.removeEventListener(event, handleVideoEvent(event));
                });
            };
        } else {
            console.error('Video element not found');
        }
    }, []);

    return (
        <div className="video-backdrop">
            <video
                ref={videoRef}
                className="video-backdrop-element"
                style={parallaxStyle}
                muted
                loop
                playsInline
                preload="auto"
                onLoadStart={() => console.log('Video load started')}
                onCanPlay={() => console.log('Video can play')}
                onError={(e) => console.error('Video error:', e)}
                onLoadedData={() => console.log('Video data loaded')}
            >
                <source src="/backdrop.mp4" type="video/mp4" />
                {/* Fallback for browsers that don't support video */}
                <div className="video-fallback" />
            </video>
            
            {/* Overlay gradient for better content visibility */}
            <div className="video-backdrop-overlay" />
        </div>
    );
};

export default VideoBackdrop;