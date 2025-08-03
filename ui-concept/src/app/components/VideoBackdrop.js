import React, { useRef, useEffect, useState, useCallback } from 'react';

const VideoBackdrop = ({ viewState, screenCenter, onVideoChange }) => {
    // State for video files (loaded dynamically)
    const [videoFiles, setVideoFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // State for video cycling
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [videoLayers, setVideoLayers] = useState({
        layer1: { index: 0, opacity: 1 },
        layer2: { index: 1, opacity: 0 }
    });
    
    // Refs for video elements
    const video1Ref = useRef(null);
    const bgVideo1Ref = useRef(null);
    const video2Ref = useRef(null);
    const bgVideo2Ref = useRef(null);
    const cycleIntervalRef = useRef(null);
    const isTransitioningRef = useRef(false);
    
    // Function to perform the actual transition
    const performTransition = useCallback((targetIndex, visibleLayer, hiddenLayer) => {
        console.log('Performing transition - visible:', visibleLayer, 'hidden:', hiddenLayer);
        
        let fadeProgress = 0;
        const transitionInterval = setInterval(() => {
            fadeProgress += 0.033; // ~30fps for 3 second transition
            
            if (fadeProgress >= 1) {
                // Transition complete
                console.log('Transition complete');
                clearInterval(transitionInterval);
                
                // Set final state
                setVideoLayers(prev => ({
                    layer1: { 
                        ...prev.layer1, 
                        opacity: hiddenLayer === 'layer1' ? 1 : 0 
                    },
                    layer2: { 
                        ...prev.layer2, 
                        opacity: hiddenLayer === 'layer2' ? 1 : 0 
                    }
                }));
                
                setCurrentVideoIndex(targetIndex);
                isTransitioningRef.current = false;
                
                // Notify parent
                if (onVideoChange) {
                    onVideoChange({
                        currentIndex: targetIndex,
                        videoInfo: videoFiles[targetIndex],
                        totalVideos: videoFiles.length
                    });
                }
            } else {
                // Update opacities during transition
                setVideoLayers(prev => ({
                    layer1: { 
                        ...prev.layer1, 
                        opacity: visibleLayer === 'layer1' ? (1 - fadeProgress) : fadeProgress
                    },
                    layer2: { 
                        ...prev.layer2, 
                        opacity: visibleLayer === 'layer2' ? (1 - fadeProgress) : fadeProgress
                    }
                }));
            }
        }, 33);
    }, [videoFiles, onVideoChange]);
    
    // Function to transition to next video
    const transitionToVideo = useCallback((targetIndex) => {
        if (isTransitioningRef.current) {
            console.log('Already transitioning, skipping');
            return;
        }
        
        console.log('Starting transition to video:', targetIndex, videoFiles[targetIndex].name);
        isTransitioningRef.current = true;
        
        // Get current layer states
        setVideoLayers(currentLayers => {
            const visibleLayer = currentLayers.layer1.opacity > 0.5 ? 'layer1' : 'layer2';
            const hiddenLayer = visibleLayer === 'layer1' ? 'layer2' : 'layer1';
            
            console.log('Current state - visible:', visibleLayer, 'hidden:', hiddenLayer);
            
            // Update hidden layer with new video and start transition after delay
            setTimeout(() => {
                performTransition(targetIndex, visibleLayer, hiddenLayer);
            }, 500);
            
            // Return state with new video in hidden layer
            return {
                ...currentLayers,
                [hiddenLayer]: { ...currentLayers[hiddenLayer], index: targetIndex }
            };
        });
    }, [videoFiles, performTransition]);
    
    // Cycle to next/previous video
    const cycleVideo = useCallback((direction, isManual = false) => {
        const newIndex = direction === 'next' 
            ? (currentVideoIndex + 1) % videoFiles.length
            : (currentVideoIndex - 1 + videoFiles.length) % videoFiles.length;
        
        console.log(`Cycling video ${direction} from ${currentVideoIndex} to ${newIndex} (${videoFiles[newIndex].name})`);
        transitionToVideo(newIndex);
        
        // Notify parent if manual change
        if (isManual && onVideoChange) {
            onVideoChange({
                currentIndex: newIndex,
                videoInfo: videoFiles[newIndex],
                totalVideos: videoFiles.length,
                isManual: true
            });
        }
    }, [currentVideoIndex, videoFiles, transitionToVideo, onVideoChange]);
    
    // Fetch available videos on mount
    useEffect(() => {
        fetch('/api/videos')
            .then(res => res.json())
            .then(data => {
                if (data.videos && data.videos.length > 0) {
                    console.log('Discovered videos:', data.videos);
                    setVideoFiles(data.videos);
                    
                    // Initialize with second video if available (for layer2)
                    if (data.videos.length > 1) {
                        setVideoLayers(prev => ({
                            ...prev,
                            layer2: { ...prev.layer2, index: 1 }
                        }));
                    }
                    
                    // Send initial video info
                    if (onVideoChange) {
                        onVideoChange({
                            currentIndex: 0,
                            videoInfo: data.videos[0],
                            totalVideos: data.videos.length,
                            isManual: false
                        });
                    }
                } else {
                    console.warn('No videos found in public directory');
                }
                setIsLoading(false);
            })
            .catch(error => {
                console.error('Failed to fetch videos:', error);
                setIsLoading(false);
            });
    }, [onVideoChange]);
    
    // Auto-cycle videos every 60 seconds
    useEffect(() => {
        cycleIntervalRef.current = setInterval(() => {
            cycleVideo('next');
        }, 60000); // 60 seconds
        
        return () => {
            if (cycleIntervalRef.current) {
                clearInterval(cycleIntervalRef.current);
            }
        };
    }, [cycleVideo]);
    
    // Keyboard controls for manual cycling (Shift + Left/Right)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Check if shift is held
            if (e.shiftKey) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    console.log('Triggering prev video cycle');
                    cycleVideo('prev', true);
                    // Reset auto-cycle timer
                    if (cycleIntervalRef.current) {
                        clearInterval(cycleIntervalRef.current);
                        cycleIntervalRef.current = setInterval(() => {
                            cycleVideo('next');
                        }, 60000);
                    }
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    console.log('Triggering next video cycle');
                    cycleVideo('next', true);
                    // Reset auto-cycle timer
                    if (cycleIntervalRef.current) {
                        clearInterval(cycleIntervalRef.current);
                        cycleIntervalRef.current = setInterval(() => {
                            cycleVideo('next');
                        }, 60000);
                    }
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cycleVideo]);
    
    // Setup videos on mount
    useEffect(() => {
        const setupVideo = (videoElement, name) => {
            if (!videoElement) return;
            
            videoElement.muted = true;
            videoElement.playsInline = true;
            videoElement.loop = true;
            videoElement.playbackRate = 0.75;
            
            videoElement.play().catch(error => {
                console.log(`${name} video autoplay failed:`, error);
            });
        };
        
        setupVideo(video1Ref.current, 'Layer1-Main');
        setupVideo(bgVideo1Ref.current, 'Layer1-Background');
        setupVideo(video2Ref.current, 'Layer2-Main');
        setupVideo(bgVideo2Ref.current, 'Layer2-Background');
    }, []);
    
    // Update video sources when layers change
    useEffect(() => {
        if (!videoFiles.length) return;
        
        console.log('Video state:', {
            layer1: `${videoFiles[videoLayers.layer1.index]?.name || 'Loading'} (${videoLayers.layer1.opacity.toFixed(2)})`,
            layer2: `${videoFiles[videoLayers.layer2.index]?.name || 'Loading'} (${videoLayers.layer2.opacity.toFixed(2)})`
        });
        
        // Update layer 1 videos
        const layer1Video = videoFiles[videoLayers.layer1.index];
        if (layer1Video && video1Ref.current && video1Ref.current.src !== window.location.origin + layer1Video.src) {
            video1Ref.current.src = layer1Video.src;
            video1Ref.current.load();
            video1Ref.current.play().catch(e => console.log('Layer1 main play failed:', e));
        }
        if (layer1Video && bgVideo1Ref.current && bgVideo1Ref.current.src !== window.location.origin + layer1Video.src) {
            bgVideo1Ref.current.src = layer1Video.src;
            bgVideo1Ref.current.load();
            bgVideo1Ref.current.play().catch(e => console.log('Layer1 bg play failed:', e));
        }
        
        // Update layer 2 videos
        const layer2Video = videoFiles[videoLayers.layer2.index];
        if (layer2Video && video2Ref.current && video2Ref.current.src !== window.location.origin + layer2Video.src) {
            video2Ref.current.src = layer2Video.src;
            video2Ref.current.load();
            video2Ref.current.play().catch(e => console.log('Layer2 main play failed:', e));
        }
        if (layer2Video && bgVideo2Ref.current && bgVideo2Ref.current.src !== window.location.origin + layer2Video.src) {
            bgVideo2Ref.current.src = layer2Video.src;
            bgVideo2Ref.current.load();
            bgVideo2Ref.current.play().catch(e => console.log('Layer2 bg play failed:', e));
        }
    }, [videoLayers, videoFiles]);

    // Don't render until videos are loaded
    if (isLoading || videoFiles.length === 0) {
        return null;
    }
    
    return (
        <>
            {/* Layer 1 Videos */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '8000vw',
                height: '8000vh',
                transform: `translate(-50%, -50%) translateZ(-20000px)`,
                transformStyle: 'preserve-3d',
                pointerEvents: 'none',
                opacity: videoLayers.layer1.opacity,
                transition: 'opacity 0.1s linear'
            }}>
                <video
                    ref={bgVideo1Ref}
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
                />
            </div>
            
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '6000vw',
                height: '6000vh',
                transform: `translate(-50%, -50%) translateZ(-15000px)`,
                transformStyle: 'preserve-3d',
                pointerEvents: 'none',
                opacity: videoLayers.layer1.opacity,
                transition: 'opacity 0.1s linear'
            }}>
                <video
                    ref={video1Ref}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                    muted
                    loop
                    playsInline
                    preload="auto"
                />
            </div>
            
            {/* Layer 2 Videos */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '8000vw',
                height: '8000vh',
                transform: `translate(-50%, -50%) translateZ(-20000px)`,
                transformStyle: 'preserve-3d',
                pointerEvents: 'none',
                opacity: videoLayers.layer2.opacity,
                transition: 'opacity 0.1s linear'
            }}>
                <video
                    ref={bgVideo2Ref}
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
                />
            </div>
            
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '6000vw',
                height: '6000vh',
                transform: `translate(-50%, -50%) translateZ(-15000px)`,
                transformStyle: 'preserve-3d',
                pointerEvents: 'none',
                opacity: videoLayers.layer2.opacity,
                transition: 'opacity 0.1s linear'
            }}>
                <video
                    ref={video2Ref}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                    muted
                    loop
                    playsInline
                    preload="auto"
                />
            </div>
        </>
    );
};

export default VideoBackdrop;