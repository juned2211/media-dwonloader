import { NextResponse } from 'next/server';
const { create } = require('youtube-dl-exec');
import path from 'path';
import fs from 'fs';
import ytdl from '@distube/ytdl-core';

// Helper to get binary path
const getBinaryPath = () => {
    // Detect OS
    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';

    const possiblePaths = [
        path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', binaryName),
        path.join(process.cwd(), 'bin', binaryName), // Custom bin?
        path.join('/tmp', binaryName) // If we were to download it there
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }

    return null;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    try {
        // Check if it's a YouTube URL
        const isYouTube = ytdl.validateURL(url);

        if (isYouTube) {
            console.log("Detected YouTube URL, using @distube/ytdl-core");

            // Add robust options for Vercel/Serverless environment
            const info = await ytdl.getInfo(url, {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                    }
                }
            });
            const videoDetails = info.videoDetails;

            const formats = [
                { quality: "1080p", type: "mp4", label: "High Definition" },
                { quality: "720p", type: "mp4", label: "Standard HD" },
                { quality: "480p", type: "mp4", label: "Standard" },
                { quality: "Highest", type: "mp3", label: "High Quality Audio", isAudio: true },
            ];

            return NextResponse.json({
                title: videoDetails.title,
                thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url, // Highest quality thumbnail
                duration: formatDuration(parseInt(videoDetails.lengthSeconds)),
                author: videoDetails.author.name,
                formats: formats
            });
        }

        // Fallback to youtube-dl-exec for other sites (Likely to fail on Vercel without binary)
        console.log("Not a YouTube URL, trying youtube-dl-exec");
        const binaryPath = getBinaryPath();
        const youtubedl = binaryPath ? create(binaryPath) : create(path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'));

        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
        });

        const options = [
            { quality: "1080p", type: "mp4", label: "High Definition" },
            { quality: "720p", type: "mp4", label: "Standard HD" },
            { quality: "480p", type: "mp4", label: "Standard" },
            { quality: "Highest", type: "mp3", label: "High Quality Audio", isAudio: true },
        ];

        return NextResponse.json({
            title: output.title,
            thumbnail: output.thumbnail,
            duration: formatDuration(output.duration),
            author: output.uploader,
            formats: options
        });

    } catch (error: any) {
        console.error("Error fetching video info:", error);
        return NextResponse.json({ error: 'Failed to fetch info', details: error.message || error.toString() }, { status: 500 });
    }
}

function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}
