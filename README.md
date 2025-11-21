# YouTube Downloader

A modern, responsive YouTube video and audio downloader application.

## Features

- 🎥 **Video Download**: Download videos in MP4 format.
- 🎵 **Audio Download**: Extract audio in MP3 format.
- 🎨 **Modern UI**: Glassmorphism design with smooth animations and gradients.
- 📱 **Responsive**: Works seamlessly on desktop and mobile devices.
- ⚙️ **Configurable Backend**: Easily switch between local and remote backend servers.

## Project Structure

This repository contains two main folders:

- **client**: The frontend React application (Vite + Tailwind CSS).
- **server**: The backend Node.js application (Express + ytdl-core).

## Deployment

### Frontend (GitHub Pages / Vercel / Netlify)

The frontend is located in the `client` directory.

**Important:** This application requires a backend server to function. The frontend deployed on GitHub Pages is a static site and cannot download videos by itself. You must run the backend server locally or deploy it to a service that supports Node.js (like Render, Railway, or Heroku).

### Backend

The backend is located in the `server` directory. It handles the video processing and downloading logic.

## Running Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/danidevdc/yt-downloader.git
    cd yt-downloader
    ```

2.  **Setup Backend:**
    ```bash
    cd server
    npm install
    node index.js
    ```
    The server will start on `http://localhost:3001`.

3.  **Setup Frontend:**
    Open a new terminal:
    ```bash
    cd client
    npm install
    npm run dev
    ```
    The app will open at `http://localhost:5173`.

## Technologies

- **Frontend:** React, Vite, Tailwind CSS, Lucide React
- **Backend:** Node.js, Express, cors, ytdl-core (or equivalent)

## License

MIT
