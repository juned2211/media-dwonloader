import { NextResponse } from 'next/server';
const { create } = require('youtube-dl-exec');
import path from 'path';
import fs from 'fs';

// Helper to get binary path
const getBinaryPath = () => {
    // Check common paths
    const localPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
    if (fs.existsSync(localPath)) return localPath;

    // Fallback or linux/mac (just 'yt-dlp' if in path, or checks other locs)
    // For this user on Windows, the above should work.
    return path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    try {
        const binaryPath = getBinaryPath();
        const youtubedl = create(binaryPath);

        // dumpSingleJson: true gives us all metadata in JSON format
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
    } catch (error) {
        console.error("Error fetching video info:", error);
        return NextResponse.json({ error: 'Failed to fetch video info' }, { status: 500 });
    }
}

function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}
