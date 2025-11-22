const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const url = process.platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

const filePath = path.join(__dirname, binaryName);

console.log(`Downloading ${binaryName} from ${url}...`);

const file = fs.createWriteStream(filePath);

https.get(url, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            redirectResponse.on('end', () => finishDownload());
        });
    } else {
        response.pipe(file);
        response.on('end', () => finishDownload());
    }
}).on('error', (err) => {
    console.error('Error downloading file:', err);
    process.exit(1);
});

function finishDownload() {
    file.on('finish', () => {
        file.close(() => {
            console.log('Download completed.');
            if (process.platform !== 'win32') {
                try {
                    execSync(`chmod +x ${filePath}`);
                    console.log('Made executable.');
                } catch (e) {
                    console.error('Error setting permissions:', e);
                }
            }
        });
    });
}
