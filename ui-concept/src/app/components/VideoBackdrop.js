import React, { useRef, useEffect, useMemo } from 'react';

const VideoBackdrop = ({ viewState, screenCenter }) => {
    const videoRef = useRef(null);
    const bgVideoRef = useRef(null);
    
    // Calculate parallax transforms for both video layers
    const parallaxStyles = useMemo(() => {
        const { x, y, zoom } = viewState;
        
        // Grid center point (where the hexagonal grid is centered)
        const gridCenterX = screenCenter?.x || (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
        const gridCenterY = screenCenter?.y || (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
        
        // Main video parallax factors
        const mainParallaxX = 0.1;
        const mainParallaxY = 0.04;
        const mainZoomFactor = 0.2;
        
        // Background video parallax factors (less pronounced)
        const bgParallaxX = 0.05; // Half the main video parallax
        const bgParallaxY = 0.02;
        const bgZoomFactor = 0.1;
        
        // Calculate transforms relative to grid center
        const mainVideoX = (x - gridCenterX) * mainParallaxX;
        const mainVideoY = (y - gridCenterY) * mainParallaxY;
        const mainVideoZoom = 1 + (zoom - 1) * mainZoomFactor;
        
        const bgVideoX = (x - gridCenterX) * bgParallaxX;
        const bgVideoY = (y - gridCenterY) * bgParallaxY;
        const bgVideoZoom = 1.5 + (zoom - 1) * bgZoomFactor; // Start at 150% scale
        
        return {
            main: {
                transform: `translate(-50%, -50%) translate(${mainVideoX}px, ${mainVideoY}px) scale(${mainVideoZoom})`,
            },
            background: {
                transform: `translate(-50%, -50%) translate(${bgVideoX}px, ${bgVideoY}px) scale(${bgVideoZoom})`,
            }
        };
    }, [viewState, screenCenter]);

    // Handle video playback for both videos
    useEffect(() => {
        const video = videoRef.current;
        const bgVideo = bgVideoRef.current;
        
        const setupVideo = (videoElement, name) => {
            if (!videoElement) return null;
            
            console.log(`${name} video element found, attempting to play...`);
            console.log(`${name} video src:`, videoElement.src || videoElement.currentSrc);
            
            // Set video properties for better autoplay compatibility
            videoElement.muted = true;
            videoElement.playsInline = true;
            videoElement.loop = true;
            videoElement.playbackRate = 0.75; // Slow down to 75% speed
            
            return videoElement;
        };
        
        const videos = [
            { element: setupVideo(video, 'Main'), name: 'Main' },
            { element: setupVideo(bgVideo, 'Background'), name: 'Background' }
        ].filter(v => v.element);
        
        videos.forEach(({ element: videoElement, name }) => {
            // Add event listeners for debugging and auto-play
            const handleVideoEvent = (eventName) => (e) => {
                console.log(`${name} video ${eventName}:`, e);
                if (eventName === 'loadedmetadata') {
                    console.log(`${name} video duration:`, videoElement.duration);
                    console.log(`${name} video dimensions:`, videoElement.videoWidth, 'x', videoElement.videoHeight);
                }
                if (eventName === 'canplay' || eventName === 'canplaythrough') {
                    // Force play when video is ready
                    if (videoElement.paused) {
                        console.log(`${name} video is ready, forcing play...`);
                        videoElement.play().then(() => {
                            console.log(`${name} video forced to play successfully`);
                        }).catch(err => {
                            console.error(`Failed to force play ${name} video:`, err);
                        });
                    }
                }
            };
            
            ['loadstart', 'loadedmetadata', 'canplay', 'canplaythrough', 'play', 'pause', 'ended', 'error'].forEach(event => {
                videoElement.addEventListener(event, handleVideoEvent(event));
            });
            
            // Try to play after a short delay
            setTimeout(() => {
                const playPromise = videoElement.play();
                
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log(`${name} video is playing successfully`);
                        })
                        .catch(error => {
                            console.error(`${name} video autoplay failed:`, error);
                            
                            // Fallback: try to play on user interaction
                            const tryPlayOnInteraction = () => {
                                videoElement.play().then(() => {
                                    console.log(`${name} video started playing after user interaction`);
                                    document.removeEventListener('click', tryPlayOnInteraction);
                                    document.removeEventListener('touchstart', tryPlayOnInteraction);
                                }).catch(e => console.error(`Still failed to play ${name} video:`, e));
                            };
                            
                            document.addEventListener('click', tryPlayOnInteraction);
                            document.addEventListener('touchstart', tryPlayOnInteraction);
                        });
                }
            }, 100);
        });
        
        return () => {
            videos.forEach(({ element: videoElement, name }) => {
                ['loadstart', 'loadedmetadata', 'canplay', 'canplaythrough', 'play', 'pause', 'ended', 'error'].forEach(event => {
                    videoElement.removeEventListener(event, () => {});
                });
            });
        };
    }, []);

    return (
        <div className="video-backdrop">
            {/* Background blurred video at 200% size */}
            <video
                ref={bgVideoRef}
                className="video-backdrop-bg"
                style={parallaxStyles.background}
                muted
                loop
                playsInline
                preload="auto"
            >
                <source src="/backdrop.mp4" type="video/mp4" />
                <div className="video-fallback" />
            </video>
            
            {/* Main parallax video */}
            <video
                ref={videoRef}
                className="video-backdrop-element"
                style={parallaxStyles.main}
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