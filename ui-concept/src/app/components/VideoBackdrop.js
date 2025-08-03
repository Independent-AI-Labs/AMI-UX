import React, { useRef, useEffect, useMemo } from 'react';

const VideoBackdrop = ({ viewState, screenCenter }) => {
    const videoRef = useRef(null);
    const bgVideoRef = useRef(null);
    
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
        <>
            {/* Background blurred video - far back in Z space */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '8000vw',
                height: '8000vh',
                transform: `translate(-50%, -50%) translateZ(-20000px)`,
                transformStyle: 'preserve-3d',
                pointerEvents: 'none'
            }}>
                <video
                    ref={bgVideoRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: 'blur(20px)'
                    }}
                    muted
                    loop
                    playsInline
                    preload="auto"
                >
                    <source src="/backdrop.mp4" type="video/mp4" />
                </video>
            </div>
            
            {/* Main video layer - closer in Z space */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '6000vw',
                height: '6000vh',
                transform: `translate(-50%, -50%) translateZ(-15000px)`,
                transformStyle: 'preserve-3d',
                pointerEvents: 'none'
            }}>
                <video
                    ref={videoRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
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
                </video>
            </div>
            
            {/* Overlay removed - will be in main page for interaction */}
        </>
    );
};

export default VideoBackdrop;