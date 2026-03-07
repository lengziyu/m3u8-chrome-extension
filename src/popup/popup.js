const clientStatusNode = document.querySelector("#client-status");
const pageStatusNode = document.querySelector("#page-status");
const pageTitleNode = document.querySelector("#page-title");
const messageTextNode = document.querySelector("#message-text");
const variantsNode = document.querySelector("#variants");
const refreshButton = document.querySelector("#refresh-button");
const variantTemplate = document.querySelector("#variant-template");

function setChip(element, text, kind = "muted") {
  element.textContent = text;
  element.className = `status-chip ${kind}`;
}

function setMessage(text) {
  messageTextNode.textContent = text;
}

function clearVariants() {
  variantsNode.innerHTML = "";
}

function renderVariants(state) {
  clearVariants();

  const variants = state?.source?.variants || [];
  const recentSuccess = state?.lastTaskResult?.ok ? state.lastTaskResult : null;
  if (!variants.length) {
    return;
  }

  const clientReady = Boolean(state.clientStatus?.ok);
  for (const variant of variants) {
    const node = variantTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".variant-resolution").textContent = variant.resolution;
    node.querySelector(".variant-url").textContent = variant.url;
    if (recentSuccess?.variantUrl === variant.url) {
      node.querySelector(".variant-resolution").textContent = `${variant.resolution} · 已加入`;
    }
    node.disabled = !clientReady;
    node.addEventListener("click", async () => {
      node.disabled = true;
      setMessage(`正在发送 ${variant.resolution} 到本地下载器…`);

      const response = await chrome.runtime.sendMessage({
        type: "ADD_TASK",
        payload: {
          variantUrl: variant.url
        }
      });

      if (response?.ok) {
        setMessage(`已加入下载队列：${variant.resolution}`);
      } else {
        setMessage(response?.error || "发送失败");
        node.disabled = !clientReady;
      }
    });

    variantsNode.appendChild(node);
  }
}

function renderPageState(state) {
  if (!state.supported) {
    setChip(pageStatusNode, "不支持", "error");
    pageTitleNode.textContent = "当前标签页不是支持的网站。";
    setMessage("请在 missav.ws 视频详情页打开插件。");
    clearVariants();
    return;
  }

  if (!state.detailPage) {
    setChip(pageStatusNode, "非详情页", "error");
    pageTitleNode.textContent = state.pageTitle || state.pageUrl || "当前页面未命中视频详情页规则。";
    setMessage("第一版只在 MissAV 视频详情页生效。");
    clearVariants();
    return;
  }

  setChip(pageStatusNode, "已识别", "success");
  pageTitleNode.textContent = state.pageTitle || state.pageUrl || "MissAV 视频详情页";

  if (state.source?.parsing) {
    setMessage("已抓到 master playlist，正在解析分辨率…");
    clearVariants();
    return;
  }

  if (state.source?.variants?.length) {
    if (state.lastTaskResult && state.lastTaskResult.ok === false) {
      setMessage(state.lastTaskResult.error || "发送失败");
    } else if (state.lastTaskResult?.ok) {
      setMessage(`最近已加入下载队列：${state.lastTaskResult.resolution}`);
    } else if (state.clientStatus?.ok) {
      setMessage("选择一个分辨率，发送到本地 M3U8-Downloader。");
    } else {
      setMessage("已经识别到可选分辨率。请先启动本地客户端 M3U8-Downloader。");
    }
    renderVariants(state);
    return;
  }

  if (state.source?.masterUrl) {
    setMessage(state.lastError || "已抓到 playlist.m3u8，但还没有解析出可用分辨率。");
    clearVariants();
    return;
  }

  setMessage("还没有抓到 playlist.m3u8。先让页面播放器开始加载，必要时播放一下视频后再点刷新。");
  clearVariants();
}

function renderClientState(state) {
  if (state.clientStatus?.ok) {
    setChip(clientStatusNode, "在线", "success");
    return;
  }

  setChip(clientStatusNode, "未启动", "error");
}

async function refresh() {
  setMessage("正在刷新状态…");
  clearVariants();

  const state = await chrome.runtime.sendMessage({
    type: "GET_POPUP_STATE"
  });

  renderClientState(state);
  renderPageState(state);
}

refreshButton.addEventListener("click", refresh);
refresh();
