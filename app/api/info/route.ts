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
            console.log("Detected YouTube URL, using Proxy APIs (Bypassing Vercel IP)");

            // Extract Video ID
            let videoId = "";
            if (url.includes("v=")) {
                videoId = url.split("v=")[1].split("&")[0];
            } else if (url.includes("youtu.be/")) {
                videoId = url.split("youtu.be/")[1].split("?")[0];
            } else if (url.includes("shorts/")) {
                videoId = url.split("shorts/")[1].split("?")[0];
            }

            if (!videoId) throw new Error("Could not extract Video ID");

            // Definition of Proxy APIs
            // Use a diverse list to increase uptime probability on Vercel
            const PROXIES = [
                // 1. Piped Instances (Try these first - they are usually faster)
                { type: 'piped', url: 'https://pipedapi.kavin.rocks' },
                { type: 'piped', url: 'https://api.piped.video' },
                { type: 'piped', url: 'https://pipedapi.tokhmi.xyz' },
                { type: 'piped', url: 'https://pipedapi.moomoo.me' },
                { type: 'piped', url: 'https://api.piped.projectsegfau.lt' },
                { type: 'piped', url: 'https://pipedapi.ducks.party' },
                { type: 'piped', url: 'https://api.piped.privacy.com.de' },
                { type: 'piped', url: 'https://api.piped.r4fo.com' },
                { type: 'piped', url: 'https://pipedapi.adminforge.de' },
                { type: 'piped', url: 'https://pipedapi.smnz.de' },

                // 2. Invidious Instances (Fallback)
                { type: 'invidious', url: 'https://inv.nadeko.net' },
                { type: 'invidious', url: 'https://yewtu.be' },
                { type: 'invidious', url: 'https://invidious.privacydev.net' },
                { type: 'invidious', url: 'https://invidious.drgns.space' },
                { type: 'invidious', url: 'https://invidious.lunar.icu' },
                { type: 'invidious', url: 'https://invidious.projectsegfau.lt' },
                { type: 'invidious', url: 'https://invidious.fdn.fr' },
                { type: 'invidious', url: 'https://vid.puffyan.us' },
                { type: 'invidious', url: 'https://invidious.flokinet.to' }
            ];

            const HEADERS = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            };

            let data;
            let usedProxyType = '';
            let lastError = '';

            for (const proxy of PROXIES) {
                try {
                    // console.log(`Fetching from ${proxy.type} (${proxy.url})...`); // Comment out to reduce noise if needed

                    let fetchUrl = '';
                    if (proxy.type === 'piped') {
                        fetchUrl = `${proxy.url}/streams/${videoId}`;
                    } else {
                        fetchUrl = `${proxy.url}/api/v1/videos/${videoId}`;
                    }

                    // Set timeout to avoid hanging on slow instances
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds per try

                    const response = await fetch(fetchUrl, {
                        headers: HEADERS,
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        data = await response.json();

                        // Validate data structure 
                        if (proxy.type === 'piped' && !data.title) throw new Error("Invalid Piped response");
                        if (proxy.type === 'invidious' && !data.title) throw new Error("Invalid Invidious response");

                        usedProxyType = proxy.type;
                        break;
                    } else {
                        // console.log(`Failed ${proxy.url}: ${response.status}`);
                        lastError = `Failed ${proxy.url}: ${response.status}`;
                    }
                } catch (e: any) {
                    console.error(`Error connecting to ${proxy.url}: ${e.message}`);
                    lastError = `Error connecting to ${proxy.url}: ${e.message}`;
                }
            }

            if (!data) throw new Error(`All Proxy APIs failed. Last error: ${lastError}`);

            // Map Response based on Proxy Type
            const formats: any[] = [];

            if (usedProxyType === 'piped') {
                // Map Piped
                if (data.videoStreams) {
                    data.videoStreams.forEach((s: any) => {
                        if (!s.videoOnly) {
                            formats.push({
                                quality: s.quality || "720p",
                                type: "mp4",
                                label: `Video ${s.quality}`,
                                url: s.url,
                                direct: true
                            });
                        }
                    });
                }
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
            } else if (usedProxyType === 'invidious') {
                // Map Invidious
                if (data.formatStreams) {
                    data.formatStreams.forEach((s: any) => {
                        formats.push({
                            quality: s.qualityLabel || s.resolution || "720p",
                            type: s.container || "mp4",
                            label: `Video ${s.qualityLabel || s.resolution}`,
                            url: s.url,
                            direct: true
                        });
                    });
                }
                // Invidious Audio is usually in adaptiveFormats
                if (data.adaptiveFormats) {
                    const bestAudio = data.adaptiveFormats.find((s: any) => s.type.includes("audio/mp4"));
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
            }

            if (formats.length === 0) {
                formats.push({ quality: "720p", type: "mp4", label: "Standard", url: "", direct: false });
            }

            return NextResponse.json({
                title: data.title,
                thumbnail: usedProxyType === 'piped' ? data.thumbnailUrl : (data.videoThumbnails ? data.videoThumbnails[0].url : ""),
                duration: formatDuration(usedProxyType === 'piped' ? data.duration : data.lengthSeconds),
                author: usedProxyType === 'piped' ? data.uploader : data.author,
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
