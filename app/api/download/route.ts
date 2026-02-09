import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Helper to get binary path
const getBinaryPath = () => {
    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';

    const possiblePaths = [
        path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', binaryName),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }

    // Default fallback (might fail if not in PATH)
    return isWindows ? 'yt-dlp.exe' : 'yt-dlp';
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const type = searchParams.get('type');
    const quality = searchParams.get('quality');

    if (!url) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    try {
        const headers = new Headers();
        const filename = `video-${Date.now()}.${type}`;
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        headers.set('Content-Type', type === 'mp3' ? 'audio/mpeg' : 'video/mp4');

        const binaryPath = getBinaryPath();
        console.log("Download Route - Binary Path:", binaryPath);

        const args = [
            url,
            '--output', '-',
            '--no-check-certificates',
            '--no-warnings',
            '--prefer-free-formats'
        ];

        if (type === 'mp3') {
            args.push('--extract-audio');
            args.push('--audio-format', 'mp3');
            args.push('--audio-quality', '0');
        } else {
            if (quality === '1080p') args.push('--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]');
            else if (quality === '720p') args.push('--format', 'bestvideo[height<=720]+bestaudio/best[height<=720]');
            else if (quality === '480p') args.push('--format', 'bestvideo[height<=480]+bestaudio/best[height<=480]');
            else args.push('--format', 'best');
        }

        const subprocess = spawn(binaryPath, args);

        const readable = new ReadableStream({
            start(controller) {
                subprocess.stdout.on('data', (chunk) => controller.enqueue(chunk));
                subprocess.stdout.on('end', () => controller.close());
                subprocess.stdout.on('error', (err) => controller.error(err));
                subprocess.stderr.on('data', (data) => console.log('yt-dlp stderr:', data.toString()));
            },
            cancel() {
                subprocess.kill();
            }
        });

        return new Response(readable, { headers });

    } catch (error) {
        console.error("Error downloading video:", error);
        return NextResponse.json({ error: 'Failed to download video' }, { status: 500 });
    }
}
