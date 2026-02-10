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
        // Workaround for Vercel EROFS: ytdl-core tries to write to disk on error.
        // We change CWD to /tmp so it can write there if needed.
        const originalCwd = process.cwd();
        try {
            process.chdir('/tmp');
        } catch (err) {
            console.log("Could not change cwd to /tmp (might be local)", err);
        }

        try {
            // Check if it's a YouTube URL
            const isYouTube = ytdl.validateURL(url);

            if (isYouTube) {
                console.log("Detected YouTube URL, using @distube/ytdl-core");

                // Add robust options for Vercel/Serverless environment
                const agent = ytdl.createAgent([
                    { name: "POT_VISITOR_INFO_1_LIVE", value: "V2fP9J9_jXo" },
                    { name: "YSC", value: "C7F8d39X5k" },
                    { name: "GPS", value: "1" }
                ]);

                const info = await ytdl.getInfo(url, {
                    agent,
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
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
        } finally {
            try {
                process.chdir(originalCwd);
            } catch (err) {
                console.log("Could not restore cwd", err);
            }
        }

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
