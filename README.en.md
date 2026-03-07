[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md)

# m3u8-chrome-extension

A Chrome Manifest V3 extension that captures HLS master playlists on supported video detail pages and sends the selected stream to the local desktop client [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader).

## Features

- The current version ships with one supported video-site adapter
- Captures `https://surrit.com/<id>/playlist.m3u8`
- Parses master playlist variants
- Provides both an in-page action panel and a popup
- Can open or focus the local desktop client window
- Sends `filename_hint` so the desktop client can prefer the browser title as the final file name

## Project structure

- `manifest.json`: MV3 manifest
- `src/background.js`: service worker for capture, parsing, and local API calls
- `src/content/content.js`: page detection and in-page injected panel
- `src/adapters/`: current video-site adapter implementation
- `src/lib/m3u8.js`: master playlist fetching and parsing
- `src/lib/local-api.js`: local desktop client API wrapper
- `src/popup/`: popup UI
- [`docs/client-open-window-api.en.md`](./docs/client-open-window-api.en.md): `open-window` API doc for the desktop client

## Install in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select this project directory
5. Start the local client [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader)
6. Open a supported video detail page and let the player load once
7. Use the in-page panel or popup to pick a resolution and send it to the downloader

## Open-source distribution

Use GitHub open-source distribution as the primary path instead of prioritizing the Chrome Web Store.

1. Users download the ZIP from GitHub or `git clone` the repo
2. Users load the project through `Load unpacked` in `chrome://extensions`
3. Users also install and run [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader)

This is the simplest path, but it requires Developer mode.

## Flow

1. The content script detects supported video detail pages and collects page metadata
2. The background worker listens for `playlist.m3u8` requests and parses variants
3. The user selects a resolution in the page panel or popup
4. The extension calls the local client `/open-window` or `/add-task`
5. The desktop client receives the task and continues the download flow
