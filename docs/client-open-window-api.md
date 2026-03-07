[中文](./client-open-window-api.md) | [English](./client-open-window-api.en.md) | [日本語](./client-open-window-api.ja.md)

# 客户端 open-window 接口

插件现在要求桌面客户端 [M3U8-Downloader](https://github.com/lengziyu/m3u8-downloader) 提供一个本地 HTTP 接口，用于打开或聚焦主窗口。

## 接口

- 方法：`POST`
- 地址：`http://127.0.0.1:38427/open-window`
- 请求头：`Content-Type: application/json`

请求体：

```json
{
  "source": "chrome-extension"
}
```

## 成功返回

HTTP `200`

```json
{
  "ok": true,
  "action": "focused"
}
```

`action` 可取：

- `focused`
- `opened`

## 失败返回

HTTP `500`

```json
{
  "ok": false,
  "error": "Failed to open main window"
}
```

## 客户端行为要求

1. 主窗口不存在时创建主窗口
2. 主窗口最小化时恢复窗口
3. 将主窗口显示到前台
4. 聚焦主窗口
