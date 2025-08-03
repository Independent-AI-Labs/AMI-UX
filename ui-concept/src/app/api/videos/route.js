import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const publicDir = path.join(process.cwd(), 'public');
        const files = fs.readdirSync(publicDir);
        
        // Filter for .mp4 files and create video objects
        const videos = files
            .filter(file => file.endsWith('.mp4'))
            .map(file => {
                // Create a display name from the filename
                const name = file
                    .replace('.mp4', '')
                    .replace(/^backdrop-?/i, '') // Remove "backdrop" prefix
                    .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                
                return {
                    src: `/${file}`,
                    name: name || 'Video',
                    filename: file
                };
            })
            .sort((a, b) => {
                // Sort with "backdrop.mp4" first if it exists
                if (a.filename === 'backdrop.mp4') return -1;
                if (b.filename === 'backdrop.mp4') return 1;
                return a.filename.localeCompare(b.filename);
            });
        
        return NextResponse.json({ videos });
    } catch (error) {
        console.error('Error reading video files:', error);
        return NextResponse.json({ 
            videos: [], 
            error: 'Failed to read video files' 
        }, { status: 500 });
    }
}