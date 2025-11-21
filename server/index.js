const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

const app = express();
const PORT = process.env.PORT || 3001;

// Configure ffmpeg to use the static binary
ffmpeg.setFfmpegPath(ffmpegPath);

app.use(cors());
app.use(express.json());

// Endpoint to get video info
app.get('/api/info', async (req, res) => {
    try {
        const videoURL = req.query.url;
        if (!ytdl.validateURL(videoURL)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const info = await ytdl.getInfo(videoURL);
        const formats = ytdl.filterFormats(info.formats, 'videoandaudio');

        res.json({
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
            duration: info.videoDetails.lengthSeconds,
            formats: formats.map(f => ({
                itag: f.itag,
                quality: f.qualityLabel,
                container: f.container,
                hasAudio: f.hasAudio,
                hasVideo: f.hasVideo
            }))
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video info' });
    }
});

// Endpoint to download video
app.get('/api/download', async (req, res) => {
    try {
        const { url, format, quality } = req.query;

        if (!ytdl.validateURL(url)) {
            return res.status(400).send('Invalid URL');
        }

        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);

        // If audio only requested (example logic) or specific format
        if (format === 'mp3') {
            res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
            ffmpeg(ytdl(url, { quality: 'highestaudio' }))
                .format('mp3')
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    if (!res.headersSent) res.status(500).send('Conversion failed');
                })
                .pipe(res, { end: true });
        } else {
            // Default to highest video+audio
            // Note: ytdl-core 'highest' often separates video/audio streams for high quality (1080p+).
            // For simplicity in this prototype, we'll use 'highest' which might be a container with both if available,
            // or we might need to merge. For now, let's try standard download.
            // To ensure audio+video in one file for high res, we usually need to merge streams.
            // Let's implement a simple merge if quality is high, or just standard pipe.

            // Simple version: just pipe the stream.
            ytdl(url, { quality: 'highest' })
                .pipe(res);
        }

    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) res.status(500).send('Download failed');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
