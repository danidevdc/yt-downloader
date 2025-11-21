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

        const metadata = await ytDlpWrap.getVideoInfo(videoURL);

        console.log('Metadata keys:', Object.keys(metadata));

        // Map yt-dlp format to our frontend expected format
        const formats = (metadata.formats || []).map(f => ({
            itag: f.format_id, // Use format_id as itag
            quality: f.format_note || (f.height ? `${f.height}p` : 'unknown'),
            container: f.ext,
            hasAudio: f.acodec !== 'none',
            hasVideo: f.vcodec !== 'none',
            url: f.url
        })).filter(f => f.container === 'mp4' || f.container === 'm4a' || f.container === 'webm');

        res.json({
            title: metadata.title,
            thumbnail: metadata.thumbnail,
            duration: metadata.duration,
            formats: formats
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video info' });
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

        if (format === 'mp3') {
            res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
            res.header('Content-Type', 'audio/mpeg');

            // Stream audio conversion
            ytDlpWrap.execStream([
                url,
                '-x',
                '--audio-format', 'mp3',
                '-o', '-' // Output to stdout
            ]).pipe(res);

        } else {
            res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
            res.header('Content-Type', 'video/mp4');

            // Stream video
            // For best compatibility, we ask for best video+audio that is mp4
            // Note: -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" might require ffmpeg for merging
            // yt-dlp can merge if ffmpeg is present. Render has ffmpeg usually.
            // If not, we might need to fallback to single file.

            ytDlpWrap.execStream([
                url,
                '-f', 'best[ext=mp4]/best',
                '-o', '-'
            ]).pipe(res);
        }

    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) res.status(500).send('Download failed');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
