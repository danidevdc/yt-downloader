const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize yt-dlp
const ytDlpWrap = new YTDlpWrap();
const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(__dirname, binaryName);

// Set binary path
console.log(`Using yt-dlp binary at: ${binaryPath}`);
ytDlpWrap.setBinaryPath(binaryPath);

app.use(cors());
app.use(express.json());

// Endpoint to get video info
app.get('/api/info', async (req, res) => {
    try {
        const videoURL = req.query.url;
        if (!videoURL) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Direct spawn approach for better compatibility
        console.log('Fetching metadata for:', videoURL);

        const { spawn } = require('child_process');
        const ytDlpProcess = spawn(binaryPath, [
            videoURL,
            '--dump-json',
            '--no-playlist',
            '--no-warnings',
            '--quiet'  // Suppress progress output
        ]);

        let stdout = '';
        let stderr = '';

        ytDlpProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ytDlpProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error('yt-dlp stderr:', data.toString());
        });

        ytDlpProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('yt-dlp exited with code:', code);
                console.error('stderr:', stderr);
                return res.status(500).json({ error: 'Failed to fetch video info', details: stderr });
            }

            try {
                // Extract only the JSON part (last complete JSON object)
                // yt-dlp might output progress lines before the JSON
                const lines = stdout.trim().split('\n');
                let jsonLine = '';

                // Find the line that starts with { and is valid JSON
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.startsWith('{')) {
                        try {
                            JSON.parse(line); // Test if it's valid JSON
                            jsonLine = line;
                            break;
                        } catch (e) {
                            continue;
                        }
                    }
                }

                if (!jsonLine) {
                    console.error('No valid JSON found in stdout:', stdout.substring(0, 500));
                    return res.status(500).json({ error: 'No valid JSON in response', details: 'yt-dlp did not return valid metadata' });
                }

                const metadata = JSON.parse(jsonLine);

                // Log key metadata to debug
                console.log('Metadata fetched successfully.');
                console.log('Title:', metadata.title);
                console.log('Thumbnail:', metadata.thumbnail);

                // Map yt-dlp format to our frontend expected format
                const formats = (metadata.formats || []).map(f => ({
                    itag: f.format_id,
                    quality: f.format_note || (f.height ? `${f.height}p` : 'unknown'),
                    container: f.ext,
                    hasAudio: f.acodec !== 'none',
                    hasVideo: f.vcodec !== 'none',
                    url: f.url
                })).filter(f =>
                    // Filter for useful formats (mp4/webm/m4a)
                    ['mp4', 'webm', 'm4a'].includes(f.container)
                );

                res.json({
                    title: metadata.title || 'Unknown Title',
                    thumbnail: metadata.thumbnail || (metadata.thumbnails ? metadata.thumbnails[metadata.thumbnails.length - 1].url : null),
                    duration: metadata.duration,
                    formats: formats
                });
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                console.error('stdout was:', stdout.substring(0, 500));
                res.status(500).json({ error: 'Failed to parse video info', details: parseError.message });
            }
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video info', details: error.message });
    }
});

// Endpoint to download video
app.get('/api/download', async (req, res) => {
    try {
        const { url, format } = req.query;

        if (!url) {
            return res.status(400).send('URL is required');
        }

        // Get title for filename
        const metadata = await ytDlpWrap.getVideoInfo(url);
        const title = (metadata.title || 'video').replace(/[^\w\s]/gi, '');
        const ffmpegPath = require('ffmpeg-static');
        const { spawn } = require('child_process');

        console.log(`Starting download for: ${title} (Format: ${format})`);
        console.log(`FFmpeg path: ${ffmpegPath}`);

        let args = [];
        if (format === 'mp3') {
            res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
            res.header('Content-Type', 'audio/mpeg');
            args = [
                url,
                '-x',
                '--audio-format', 'mp3',
                '--ffmpeg-location', ffmpegPath,
                '-o', '-'
            ];
        } else {
            res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
            res.header('Content-Type', 'video/mp4');
            args = [
                url,
                '-f', 'best[ext=mp4]/best',
                '--ffmpeg-location', ffmpegPath,
                '-o', '-'
            ];
        }

        const ytDlpProcess = spawn(binaryPath, args);

        ytDlpProcess.stdout.pipe(res);

        ytDlpProcess.stderr.on('data', (data) => {
            console.error(`yt-dlp stderr: ${data}`);
        });

        ytDlpProcess.on('close', (code) => {
            console.log(`yt-dlp process exited with code ${code}`);
            if (code !== 0 && !res.headersSent) {
                res.status(500).send('Download failed');
            }
        });

    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) res.status(500).send('Download failed');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
