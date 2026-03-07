[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md)

# m3u8-chrome-extension

Chrome Manifest V3 插件，用于在已适配的视频网站详情页捕获 HLS master playlist，选择分辨率后发送到本地桌面客户端 [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader)。

## 功能

- 当前版本包含 1 个已适配视频网站实现
- 捕获 `https://surrit.com/<id>/playlist.m3u8`
- 解析 master playlist 分辨率
- 支持页面内操作区和 popup 两种入口
- 支持打开本地客户端窗口
- 发送 `filename_hint`，让桌面端优先使用浏览器标题作为最终文件名

## 项目结构

- `manifest.json`: MV3 清单
- `src/background.js`: 后台 service worker，负责抓源、解析和本地 API 调用
- `src/content/content.js`: 页面内识别与注入操作面板
- `src/adapters/`: 当前视频网站适配实现
- `src/lib/m3u8.js`: master playlist 获取与解析
- `src/lib/local-api.js`: 本地桌面客户端 API 封装
- `src/popup/`: popup UI
- [`docs/client-open-window-api.md`](./docs/client-open-window-api.md): 客户端 `open-window` 接口文档

## 安装到 Chrome

1. 打开 `chrome://extensions`
2. 开启右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前项目目录
5. 启动本地客户端 [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader)
6. 打开一个已适配的视频详情页，并让视频播放器实际加载一次
7. 在页面内面板或 popup 中选择分辨率并添加到下载器

## 开源分发

推荐直接走 GitHub 开源发布，不优先走 Chrome Web Store。

1. 用户从 GitHub 下载 ZIP 或 `git clone`
2. 在 `chrome://extensions` 中使用“加载已解压的扩展程序”
3. 同时安装并启动 [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader)

这种方式最简单，但用户需要开启开发者模式。

## 工作流程

1. 内容脚本识别已适配的视频详情页并提取页面信息
2. 后台监听 `playlist.m3u8` 请求并解析可选分辨率
3. 用户在页面内面板或 popup 中选择分辨率
4. 插件调用本地客户端 `/open-window` 或 `/add-task`
5. 客户端接收任务并开始下载流程
