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

        console.log('Fetching metadata for:', videoURL);

        try {
            // Use execPromise which handles output better
            const stdout = await ytDlpWrap.execPromise([
                videoURL,
                '--dump-json',
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificates'  // Skip SSL verification which can cause issues
            ]);

            console.log('Raw stdout length:', stdout.length);
            console.log('First 200 chars:', stdout.substring(0, 200));

            // Try to parse the entire stdout as JSON first
            let metadata;
            try {
                metadata = JSON.parse(stdout);
            } catch (e) {
                // If that fails, try to find a valid JSON line
                const lines = stdout.trim().split('\n');
                let jsonLine = '';

                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.startsWith('{')) {
                        try {
                            metadata = JSON.parse(line);
                            jsonLine = line;
                            break;
                        } catch (parseErr) {
                            continue;
                        }
                    }
                }

                if (!metadata) {
                    console.error('Could not parse JSON from stdout');
                    console.error('Full stdout:', stdout);
                    return res.status(500).json({
                        error: 'Failed to parse video info',
                        details: 'No valid JSON found in yt-dlp output'
                    });
                }
            }

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

        } catch (ytdlpError) {
            console.error('yt-dlp execution error:', ytdlpError);
            console.error('Error message:', ytdlpError.message);
            console.error('Error stack:', ytdlpError.stack);

            return res.status(500).json({
                error: 'Failed to fetch video info',
                details: ytdlpError.message || 'yt-dlp execution failed'
            });
        }

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
