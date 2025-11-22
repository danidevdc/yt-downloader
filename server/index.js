const express = require('express');
const cors = require('cors');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

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
        console.log('Binary path:', binaryPath);
        console.log('Binary exists:', fs.existsSync(binaryPath));

        // Diagnostic checks
        try {
            // Check file details
            if (process.platform !== 'win32') {
                try {
                    const lsOutput = execSync(`ls -l "${binaryPath}"`).toString();
                    console.log('Binary permissions:', lsOutput.trim());
                } catch (e) {
                    console.log('ls failed:', e.message);
                }
            }

            // Check version
            try {
                const versionOutput = execSync(`"${binaryPath}" --version`).toString();
                console.log('yt-dlp version:', versionOutput.trim());
            } catch (verErr) {
                console.error('Version check failed:', verErr.message);
                // If version check fails, try to print first few bytes of file to see if it's HTML or something
                try {
                    const headOutput = execSync(`head -c 50 "${binaryPath}"`).toString();
                    console.log('File head:', headOutput);
                } catch (headErr) {
                    console.log('head failed:', headErr.message);
                }
            }
        } catch (diagErr) {
            console.error('Diagnostics failed:', diagErr);
        }

        // Spawn yt-dlp process
        const ytDlpProcess = spawn(binaryPath, [
            videoURL,
            '--dump-json',
            '--no-playlist',
            '--no-warnings',
            '--no-check-certificates',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/'
        ], {
            stdio: ['ignore', 'pipe', 'pipe']  // stdin, stdout, stderr
        });

        let stdout = '';
        let stderr = '';

        ytDlpProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ytDlpProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytDlpProcess.on('error', (error) => {
            console.error('Failed to start yt-dlp process:', error);
            return res.status(500).json({
                error: 'Failed to start yt-dlp',
                details: error.message
            });
        });

        ytDlpProcess.on('close', (code) => {
            console.log('yt-dlp exited with code:', code);
            console.log('stdout length:', stdout.length);
            console.log('stderr length:', stderr.length);
            console.log('First 500 chars of stdout:', stdout.substring(0, 500));
            console.log('First 500 chars of stderr:', stderr.substring(0, 500));

            if (code !== 0) {
                console.error('yt-dlp failed with code:', code);
                return res.status(500).json({
                    error: 'yt-dlp execution failed',
                    details: stderr || 'No error details available',
                    exitCode: code
                });
            }

            if (!stdout || stdout.trim().length === 0) {
                console.error('No output from yt-dlp');
                return res.status(500).json({
                    error: 'No output from yt-dlp',
                    details: stderr || 'yt-dlp produced no output',
                    exitCode: code
                });
            }

            try {
                // Try to parse the entire stdout as JSON first
                let metadata;
                try {
                    metadata = JSON.parse(stdout);
                } catch (e) {
                    // If that fails, try to find a valid JSON line
                    const lines = stdout.trim().split('\n');

                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i].trim();
                        if (line.startsWith('{')) {
                            try {
                                metadata = JSON.parse(line);
                                break;
                            } catch (parseErr) {
                                continue;
                            }
                        }
                    }

                    if (!metadata) {
                        console.error('Could not parse JSON from stdout');
                        return res.status(500).json({
                            error: 'Failed to parse video info',
                            details: 'No valid JSON found in yt-dlp output',
                            stdout: stdout.substring(0, 1000),
                            stderr: stderr.substring(0, 1000)
                        });
                    }
                }

                // Log key metadata to debug
                console.log('Metadata fetched successfully.');
                console.log('Title:', metadata.title);

                // Map yt-dlp format to our frontend expected format
                const formats = (metadata.formats || []).map(f => ({
                    itag: f.format_id,
                    quality: f.format_note || (f.height ? `${f.height}p` : 'unknown'),
                    container: f.ext,
                    hasAudio: f.acodec !== 'none',
                    hasVideo: f.vcodec !== 'none',
                    url: f.url
                })).filter(f =>
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
                return res.status(500).json({
                    error: 'Failed to parse video info',
                    details: parseError.message,
                    stdout: stdout.substring(0, 1000)
                });
            }
        });

    } catch (error) {
        console.error('Error in /api/info:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
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

        const ytDlpProcess = spawn(binaryPath, [
            ...args,
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/'
        ]);

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
