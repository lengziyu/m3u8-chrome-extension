[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md)

# m3u8-chrome-extension

対応済みの動画詳細ページで HLS master playlist を取得し、選択した解像度をローカルのデスクトップクライアント [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader) に送る Chrome Manifest V3 拡張です。

## 主な機能

- 現在のバージョンには 1 つの対応済み動画サイトアダプターを同梱
- `https://surrit.com/<id>/playlist.m3u8` を取得
- master playlist の解像度を解析
- ページ内パネルと popup の両方を提供
- ローカルクライアントのウィンドウを開く、または前面表示
- `filename_hint` を送信し、ブラウザのタイトルを最終ファイル名として優先利用

## プロジェクト構成

- `manifest.json`: MV3 マニフェスト
- `src/background.js`: 取得、解析、ローカル API 呼び出しを行う service worker
- `src/content/content.js`: ページ判定とページ内パネルの注入
- `src/adapters/`: 現在の動画サイト用アダプター実装
- `src/lib/m3u8.js`: master playlist の取得と解析
- `src/lib/local-api.js`: ローカルクライアント API ラッパー
- `src/popup/`: popup UI
- [`docs/client-open-window-api.ja.md`](./docs/client-open-window-api.ja.md): デスクトップクライアント向け `open-window` API ドキュメント

## Chrome への導入

1. `chrome://extensions` を開く
2. 右上の開発者モードを有効化
3. `Load unpacked` をクリック
4. このプロジェクトのディレクトリを選択
5. ローカルクライアント [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader) を起動
6. 対応済みの動画詳細ページを開き、プレイヤーを一度読み込ませる
7. ページ内パネルまたは popup から解像度を選んでダウンローダーへ送信

## オープンソース配布

Chrome Web Store を優先せず、GitHub でのオープンソース配布を基本方針とします。

1. GitHub から ZIP をダウンロード、または `git clone`
2. `chrome://extensions` の `Load unpacked` で読み込む
3. [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader) もインストールして起動する

最も簡単ですが、開発者モードが必要です。

## 動作フロー

1. content script が対応済みの動画詳細ページを判定し、ページ情報を取得
2. background worker が `playlist.m3u8` リクエストを監視して解像度を解析
3. ユーザーがページ内パネルまたは popup で解像度を選択
4. 拡張がローカルクライアントの `/open-window` または `/add-task` を呼び出す
5. デスクトップクライアントがタスクを受け取り、ダウンロード処理を続行
