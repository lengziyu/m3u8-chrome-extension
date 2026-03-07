[中文](./client-open-window-api.md) | [English](./client-open-window-api.en.md) | [日本語](./client-open-window-api.ja.md)

# クライアント open-window API

この拡張は、デスクトップクライアント [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader) がメインウィンドウを開く、または前面表示するためのローカル HTTP API を提供していることを前提にしています。

## エンドポイント

- メソッド: `POST`
- URL: `http://127.0.0.1:38427/open-window`
- ヘッダー: `Content-Type: application/json`

リクエストボディ:

```json
{
  "source": "chrome-extension"
}
```

## 成功レスポンス

HTTP `200`

```json
{
  "ok": true,
  "action": "focused"
}
```

`action`:

- `focused`
- `opened`

## 失敗レスポンス

HTTP `500`

```json
{
  "ok": false,
  "error": "Failed to open main window"
}
```

## クライアント側の期待動作

1. メインウィンドウが存在しない場合は作成する
2. 最小化されている場合は復元する
3. メインウィンドウを前面に表示する
4. メインウィンドウへフォーカスを移す
