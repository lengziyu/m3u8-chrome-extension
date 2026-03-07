[中文](./client-open-window-api.md) | [English](./client-open-window-api.en.md) | [日本語](./client-open-window-api.ja.md)

# Client open-window API

The extension expects the desktop client [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader) to expose a local HTTP endpoint for opening or focusing the main window.

## Endpoint

- Method: `POST`
- URL: `http://127.0.0.1:38427/open-window`
- Header: `Content-Type: application/json`

Request body:

```json
{
  "source": "chrome-extension"
}
```

## Success response

HTTP `200`

```json
{
  "ok": true,
  "action": "focused"
}
```

`action` may be:

- `focused`
- `opened`

## Failure response

HTTP `500`

```json
{
  "ok": false,
  "error": "Failed to open main window"
}
```

## Expected client behavior

1. Create the main window if it does not exist
2. Restore the main window if it is minimized
3. Bring the main window to the foreground
4. Focus the main window
