(function bootstrap() {
  const VIDEO_SLUG_PATTERN = /^[a-z]{2,10}-?\d{2,5}(?:-[a-z0-9]+)*$/i;
  const PANEL_ID = "m3u8-downloader-bridge-root";
  const REFRESH_INTERVAL_MS = 4000;
  const SUCCESS_BADGE_MS = 15000;
  let shadowRefs = null;
  let refreshTimer = null;
  let extensionAlive = true;

  function getPathSegments() {
    return window.location.pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);
  }

  function readTitle() {
    const candidates = [
      document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      document.querySelector("h1")?.textContent,
      document.title
    ];

    return candidates.find(Boolean)?.trim() || "";
  }

  function isVideoSlug(slug) {
    return VIDEO_SLUG_PATTERN.test(slug);
  }

  function getDetailSlugCandidate(segments) {
    const lastSegment = segments[segments.length - 1] || "";
    return isVideoSlug(lastSegment) ? lastSegment : "";
  }

  function isDetailPage() {
    const segments = getPathSegments();
    return Boolean(getDetailSlugCandidate(segments));
  }

  function findMasterPlaylistHint() {
    const attributeCandidates = [
      ...document.querySelectorAll("[src], [data-src], [href], script")
    ];

    for (const node of attributeCandidates) {
      const candidates = [
        node.getAttribute?.("src"),
        node.getAttribute?.("data-src"),
        node.getAttribute?.("href"),
        node.textContent
      ].filter(Boolean);

      for (const candidate of candidates) {
        const matched = String(candidate).match(/https:\/\/surrit\.com\/[^"'\\\s]+\/playlist\.m3u8(?:\?[^"'\\\s<]*)?/i);
        if (matched) {
          return matched[0];
        }
      }
    }

    const html = document.documentElement?.innerHTML || "";
    const matched = html.match(/https:\/\/surrit\.com\/[^"'\\\s]+\/playlist\.m3u8(?:\?[^"'\\\s<]*)?/i);
    return matched ? matched[0] : "";
  }

  function sendPageContext() {
    if (!extensionAlive) {
      return;
    }

    const payload = {
      siteKey: "missav",
      pageUrl: window.location.href,
      pageTitle: readTitle(),
      detailPage: isDetailPage()
    };

    safeSendMessage({
      type: "REGISTER_PAGE",
      payload
    }).catch(() => {});

    const hintedMasterUrl = findMasterPlaylistHint();
    if (hintedMasterUrl) {
      safeSendMessage({
        type: "REPORT_M3U8_HINT",
        payload: {
          pageUrl: window.location.href,
          masterUrl: hintedMasterUrl
        }
      }).catch(() => {});
    }
  }

  function setStatusChip(node, text, kind) {
    node.textContent = text;
    node.className = `status-chip ${kind}`;
  }

  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 1)}…`;
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function isContextInvalidatedError(error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return message.includes("Extension context invalidated");
  }

  async function safeSendMessage(message) {
    if (!extensionAlive) {
      return null;
    }

    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        extensionAlive = false;
        stopAutoRefresh();
        return null;
      }

      throw error;
    }
  }

  async function handleOpenClient(button) {
    const wasDisabled = button.disabled;
    button.disabled = true;
    button.textContent = "打开中...";
    shadowRefs.message.textContent = "正在请求打开本地客户端窗口…";

    const response = await safeSendMessage({
      type: "OPEN_CLIENT_WINDOW"
    });

    if (!response) {
      return;
    }

    if (response?.ok) {
      button.textContent = "已打开客户端";
      shadowRefs.message.textContent = "已请求打开本地客户端窗口。";
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = "打开客户端";
      }, 1600);
      return;
    }

    button.disabled = wasDisabled;
    button.textContent = "打开客户端";
    shadowRefs.message.textContent = response?.error || "打开客户端失败";
  }

  function renderVariants(state) {
    shadowRefs.variants.innerHTML = "";

    const variants = state?.source?.variants || [];
    const recentSuccess =
      state?.lastTaskResult?.ok &&
      Date.now() - state.lastTaskResult.at < SUCCESS_BADGE_MS
        ? state.lastTaskResult
        : null;

    if (!variants.length) {
      return;
    }

    const canAddTask = Boolean(state.clientStatus?.ok);
    for (const variant of variants) {
      const row = document.createElement("div");
      row.className = "variant-row";

      const info = document.createElement("div");
      info.className = "variant-info";

      const resolution = document.createElement("strong");
      resolution.textContent = variant.resolution;
      info.appendChild(resolution);

      const url = document.createElement("span");
      url.textContent = truncate(variant.url, 72);
      info.appendChild(url);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "variant-button";
      button.textContent =
        recentSuccess?.variantUrl === variant.url
          ? "已加入队列"
          : canAddTask
            ? "添加到下载器"
            : "客户端未启动";
      button.disabled = !canAddTask;
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "发送中...";
        shadowRefs.message.textContent = `正在发送 ${variant.resolution} 到本地下载器…`;

        const response = await safeSendMessage({
          type: "ADD_TASK_FOR_TAB",
          payload: {
            variantUrl: variant.url
          }
        });

        if (!response) {
          return;
        }

        if (response?.ok) {
          button.textContent = "已加入队列";
          shadowRefs.message.textContent = `已加入下载队列：${variant.resolution}`;
        } else {
          button.disabled = !canAddTask;
          button.textContent = canAddTask ? "重试" : "客户端未启动";
          shadowRefs.message.textContent = response?.error || "发送失败";
        }
      });

      row.append(info, button);
      shadowRefs.variants.appendChild(row);
    }
  }

  function renderState(state) {
    if (!shadowRefs) {
      return;
    }

    const recentSuccess =
      state.lastTaskResult?.ok && Date.now() - state.lastTaskResult.at < SUCCESS_BADGE_MS
        ? state.lastTaskResult
        : null;
    const recentFailure = state.lastTaskResult && state.lastTaskResult.ok === false
      ? state.lastTaskResult
      : null;

    shadowRefs.videoTitle.textContent = readTitle() || state.pageTitle || "当前视频";
    shadowRefs.openClient.disabled = !state.clientStatus?.ok;
    setStatusChip(
      shadowRefs.clientStatus,
      state.clientStatus?.ok ? "客户端在线" : "客户端未启动",
      state.clientStatus?.ok ? "success" : "error"
    );

    if (!state.supported || !state.detailPage) {
      setStatusChip(shadowRefs.pageStatus, "非详情页", "error");
      shadowRefs.message.textContent = "当前页面未被识别为 MissAV 视频详情页。";
      shadowRefs.variants.innerHTML = "";
      return;
    }

    setStatusChip(shadowRefs.pageStatus, "详情页", "success");

    if (state.source?.parsing) {
      shadowRefs.message.textContent = "已抓到视频源，正在解析分辨率…";
      shadowRefs.variants.innerHTML = "";
      return;
    }

    if (state.source?.variants?.length) {
      if (recentFailure) {
        shadowRefs.message.textContent = recentFailure.error || "添加任务失败";
      } else if (recentSuccess) {
        shadowRefs.message.textContent = `最近已加入下载队列：${recentSuccess.resolution}`;
      } else {
        shadowRefs.message.textContent = state.clientStatus?.ok
          ? "选择一个分辨率，直接发送到本地下载器。"
          : "已经识别到分辨率。请先启动本地 M3U8-Downloader。";
      }
      renderVariants(state);
      return;
    }

    if (state.source?.masterUrl) {
      shadowRefs.message.textContent = state.lastError || "已抓到 playlist.m3u8，但还没有解析出可用分辨率。";
      shadowRefs.variants.innerHTML = "";
      return;
    }

    shadowRefs.message.textContent = "还没有抓到 playlist.m3u8。先让页面播放器开始加载，必要时点播放后再刷新。";
    shadowRefs.variants.innerHTML = "";
  }

  function findAnchor() {
    const titleSelectors = [
      "main h1",
      "article h1",
      "section h1",
      "h1",
      "[class*='title'] h1",
      "[class*='heading'] h1"
    ];

    for (const selector of titleSelectors) {
      const node = document.querySelector(selector);
      if (!node) {
        continue;
      }

      const container = node.closest("header, section, article, div") || node;
      return {
        container,
        after: true
      };
    }

    const selectors = [
      "video",
      "iframe[src*='sixyik.com']",
      "iframe[src*='surrit.com']",
      "[class*='plyr']",
      ".video-js",
      "main"
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) {
        continue;
      }

      const container = node.closest("section, article, main, div") || node.parentElement || node;
      return {
        container,
        after: true
      };
    }

    return {
      container: document.body,
      after: false
    };
  }

  function createPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      return existing;
    }

    const host = document.createElement("div");
    host.id = PANEL_ID;
    const shadowRoot = host.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
        }
        .panel {
          margin: 18px 0;
          padding: 18px;
          border: 1px solid rgba(125, 92, 255, 0.18);
          border-radius: 20px;
          background: linear-gradient(180deg, rgba(250, 247, 255, 0.98), rgba(242, 236, 255, 0.98));
          box-shadow: 0 20px 48px rgba(47, 24, 108, 0.12);
          color: #241b42;
          font: 14px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
        }
        .eyebrow {
          margin: 0 0 6px;
          color: #7156e5;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .title {
          margin: 0;
          font-size: 22px;
          line-height: 1.1;
        }
        .video-title {
          margin: 10px 0 0;
          color: #6d658f;
          font-size: 13px;
        }
        .subtitle {
          margin: 10px 0 0;
          color: #6d658f;
        }
        .status-grid {
          display: grid;
          gap: 10px;
          margin-top: 16px;
        }
        .status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .status-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 84px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          background: rgba(113, 86, 229, 0.12);
          color: #7156e5;
        }
        .status-chip.success {
          background: rgba(36, 107, 83, 0.12);
          color: #246b53;
        }
        .status-chip.error {
          background: rgba(192, 74, 132, 0.12);
          color: #c04a84;
        }
        .actions {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }
        .action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .message {
          margin: 0;
          color: #372b63;
        }
        .button-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .refresh,
        .open-client {
          border: 0;
          border-radius: 999px;
          padding: 8px 12px;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .refresh {
          background: rgba(113, 86, 229, 0.12);
          color: #5f39ff;
        }
        .open-client {
          background: rgba(36, 107, 83, 0.12);
          color: #246b53;
        }
        .open-client:disabled,
        .refresh:disabled {
          background: #d7d2ef;
          color: #7f789b;
          cursor: not-allowed;
        }
        .variants {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .variant-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border: 1px solid rgba(113, 86, 229, 0.14);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.9);
        }
        .variant-info {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .variant-info strong {
          font-size: 15px;
        }
        .variant-info span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #6d658f;
          font-size: 12px;
        }
        .variant-button {
          border: 0;
          border-radius: 999px;
          background: linear-gradient(135deg, #7d5cff, #5f39ff);
          color: #fff;
          padding: 10px 14px;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }
        .variant-button:disabled {
          background: #c9c2eb;
          cursor: not-allowed;
        }
      </style>
      <section class="panel">
        <p class="eyebrow">M3U8 Downloader Bridge</p>
        <h2 class="title">下载操作</h2>
        <p class="video-title" data-role="video-title"></p>
        <p class="subtitle">识别当前视频源，选择分辨率并发送到本地下载器。</p>
        <div class="status-grid">
          <div class="status-row">
            <span>页面状态</span>
            <strong class="status-chip success" data-role="page-status">检测中</strong>
          </div>
          <div class="status-row">
            <span>本地客户端</span>
            <strong class="status-chip" data-role="client-status">检测中</strong>
          </div>
        </div>
        <div class="actions">
          <div class="action-row">
            <p class="message" data-role="message">正在检测视频源…</p>
            <div class="button-group">
              <button class="open-client" type="button" data-role="open-client">打开客户端</button>
              <button class="refresh" type="button" data-role="refresh">刷新</button>
            </div>
          </div>
        </div>
        <div class="variants" data-role="variants"></div>
      </section>
    `;

    shadowRefs = {
      title: shadowRoot.querySelector(".title"),
      videoTitle: shadowRoot.querySelector('[data-role="video-title"]'),
      pageStatus: shadowRoot.querySelector('[data-role="page-status"]'),
      clientStatus: shadowRoot.querySelector('[data-role="client-status"]'),
      message: shadowRoot.querySelector('[data-role="message"]'),
      variants: shadowRoot.querySelector('[data-role="variants"]'),
      refresh: shadowRoot.querySelector('[data-role="refresh"]'),
      openClient: shadowRoot.querySelector('[data-role="open-client"]')
    };

    shadowRefs.refresh.addEventListener("click", () => {
      refreshState(true);
    });
    shadowRefs.openClient.addEventListener("click", () => {
      handleOpenClient(shadowRefs.openClient);
    });

    return host;
  }

  function mountPanel() {
    if (!isDetailPage()) {
      return;
    }

    const host = createPanel();
    if (document.getElementById(PANEL_ID)) {
      return;
    }

    const anchor = findAnchor();
    if (anchor.after && anchor.container.parentNode) {
      anchor.container.insertAdjacentElement("afterend", host);
      return;
    }

    anchor.container.prepend(host);
  }

  async function refreshState(forceRescan = false) {
    if (!extensionAlive || !isDetailPage()) {
      return;
    }

    if (forceRescan) {
      sendPageContext();
    }

    const state = await safeSendMessage({
      type: "GET_TAB_STATE"
    });
    if (!state) {
      return;
    }

    renderState(state);
  }

  function startAutoRefresh() {
    stopAutoRefresh();

    refreshTimer = window.setInterval(() => {
      refreshState(false).catch(() => {});
    }, REFRESH_INTERVAL_MS);
  }

  function init() {
    if (!isDetailPage()) {
      return;
    }

    mountPanel();
    sendPageContext();
    refreshState(true);
    startAutoRefresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.addEventListener("load", () => {
    mountPanel();
    sendPageContext();
    refreshState(true);
  });
}());
