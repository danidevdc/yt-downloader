const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
// Use the standalone Linux binary for non-Windows platforms
const url = process.platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

const filePath = path.join(__dirname, binaryName);

console.log(`Starting download of ${binaryName} from ${url}...`);

function downloadFile(fileUrl, destPath) {
    const file = fs.createWriteStream(destPath);

    const request = https.get(fileUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
            console.log(`Redirecting to: ${response.headers.location}`);
            file.close(); // Close the file stream before retrying
            downloadFile(response.headers.location, destPath);
            return;
        }

        // Check for successful response
        if (response.statusCode !== 200) {
            console.error(`Failed to download: Status Code ${response.statusCode}`);
            file.close();
            fs.unlink(destPath, () => { }); // Delete partial file
            process.exit(1);
            return;
        }

        // Pipe data to file
        response.pipe(file);

        file.on('finish', () => {
            file.close(() => {
                const stats = fs.statSync(destPath);
                console.log(`Download completed. File size: ${stats.size} bytes`);

                if (stats.size < 1000) {
                    console.error('Error: File is too small, likely corrupted or invalid.');
                    process.exit(1);
                }

                if (process.platform !== 'win32') {
                    try {
                        execSync(`chmod +x ${destPath}`);
                        console.log('Made executable.');
                    } catch (e) {
                        console.error('Error setting permissions:', e);
                    }
                }
            });
        });
    });

    request.on('error', (err) => {
        console.error('Error downloading file:', err);
        fs.unlink(destPath, () => { });
        process.exit(1);
    });
}

downloadFile(url, filePath);
