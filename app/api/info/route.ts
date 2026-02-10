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
            console.log("Detected YouTube URL, using Piped API Proxy (Bypassing Vercel IP)");

            // Extract Video ID
            let videoId = "";
            if (url.includes("v=")) {
                videoId = url.split("v=")[1].split("&")[0];
            } else if (url.includes("youtu.be/")) {
                videoId = url.split("youtu.be/")[1];
            } else if (url.includes("shorts/")) {
                videoId = url.split("shorts/")[1].split("?")[0];
            }

            if (!videoId) throw new Error("Could not extract Video ID");

            // Fetch from Piped API
            // Using a rotation of reliable instances if one fails
            const pipedInstances = [
                'https://pipedapi.kavin.rocks',
                'https://api.piped.video',
                'https://pipedapi.tokhmi.xyz'
            ];

            let data;
            for (const instance of pipedInstances) {
                try {
                    console.log(`Fetching from ${instance}...`);
                    const response = await fetch(`${instance}/streams/${videoId}`);
                    if (response.ok) {
                        data = await response.json();
                        break;
                    }
                } catch (e) {
                    console.log(`Failed to fetch from ${instance}`);
                }
            }

            if (!data) throw new Error("All Piped instances failed to fetch video info.");

            // Map Piped Response
            const formats = [];

            // Video Streams
            if (data.videoStreams) {
                data.videoStreams.forEach((s: any) => {
                    if (!s.videoOnly) { // Muxed streams (Audio+Video)
                        formats.push({
                            quality: s.quality || "720p",
                            type: "mp4",
                            label: `Video ${s.quality}`,
                            url: s.url,
                            direct: true
                        });
                    }
                });

                // If no muxed streams, add video-only but label them (Client might need to know)
                // For simplicity, we just look for best muxed.
                // Piped usually provides webm/mp4 muxed.
            }

            // Audio Streams
            if (data.audioStreams) {
                const bestAudio = data.audioStreams.find((s: any) => s.mimeType === "audio/mp4") || data.audioStreams[0];
                if (bestAudio) {
                    formats.push({
                        quality: "Highest",
                        type: "mp3",
                        label: "Audio Only",
                        url: bestAudio.url,
                        isAudio: true,
                        direct: true
                    });
                }
            }

            // Fallback formats if empty (shouldn't happen on Piped usually)
            if (formats.length === 0) {
                formats.push({ quality: "720p", type: "mp4", label: "Standard", url: "", direct: false });
            }

            return NextResponse.json({
                title: data.title,
                thumbnail: data.thumbnailUrl,
                duration: formatDuration(data.duration),
                author: data.uploader,
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
