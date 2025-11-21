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
            thumbnail: metadata.thumbnail || (metadata.thumbnails && metadata.thumbnails.length > 0 ? metadata.thumbnails[metadata.thumbnails.length - 1].url : null),
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

            app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });
