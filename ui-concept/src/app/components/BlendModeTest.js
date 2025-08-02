import React from 'react';

const BlendModeTest = () => {
    const hexSize = 120;
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;

    return (
        <div 
            className="lod-hex-wrapper website-tile"
            style={{
                position: 'absolute',
                left: '400px',
                top: '300px',
                zIndex: 1000,
                display: 'none' // Hidden but keep code
            }}
        >
            <div
                className="absolute"
                style={{
                    left: 0,
                    top: 0,
                    width: hexWidth,
                    height: hexHeight,
                    clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                    zIndex: 10
                }}
            >
                <div 
                    className="hex-website"
                    style={{
                        width: '100%',
                        height: '100%',
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '8px',
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: '12px'
                    }}
                >
                    <div className="hex-website-content" style={{
                        flex: 1,
                        position: 'relative',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: 'white',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        color: '#333'
                    }}>
                        <div style={{
                            background: `
                                repeating-conic-gradient(
                                    from 0deg,
                                    #000 0deg 90deg,
                                    #fff 90deg 180deg,
                                    #000 180deg 270deg,
                                    #fff 270deg 360deg
                                )
                            `,
                            backgroundSize: '15px 15px',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.9)',
                                padding: '8px',
                                borderRadius: '4px',
                                fontSize: '10px'
                            }}>
                                Test Hex
                            </div>
                        </div>
                    </div>
                    <div className="hex-website-footer" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px 0 0 0',
                        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                        marginTop: '4px'
                    }}>
                        <span style={{
                            fontFamily: 'Monaco, Menlo, monospace',
                            fontSize: '8px',
                            color: '#6b7280'
                        }}>
                            blend-test.com
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BlendModeTest;