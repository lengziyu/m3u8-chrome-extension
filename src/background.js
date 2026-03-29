import { missavAdapter } from "./adapters/missav.js";
import { fetchAndParseMasterPlaylist } from "./lib/m3u8.js";
import { addTask, openClientWindow, pingLocalClient } from "./lib/local-api.js";

const adapters = [missavAdapter];
const stateByTabId = new Map();
const storageArea = chrome.storage.session || chrome.storage.local;

function getStorageKey(tabId) {
  return `tab-state:${tabId}`;
}

function readStorage(key) {
  return new Promise((resolve) => {
    storageArea.get(key, (items) => {
      resolve(items?.[key] || null);
    });
  });
}

function writeStorage(key, value) {
  return new Promise((resolve) => {
    storageArea.set({ [key]: value }, () => {
      resolve();
    });
  });
}

function removeStorage(key) {
  return new Promise((resolve) => {
    storageArea.remove(key, () => {
      resolve();
    });
  });
}

function readTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      resolve(tab || null);
    });
  });
}

function getAdapterByUrl(url) {
  return adapters.find((adapter) => adapter.matches(url)) || null;
}

function createEmptyTabState(tabId) {
  return {
    tabId,
    siteKey: null,
    pageUrl: "",
    pageTitle: "",
    detailPage: false,
    source: null,
    lastError: "",
    lastTaskResult: null,
    updatedAt: Date.now()
  };
}

async function getOrCreateTabState(tabId) {
  if (stateByTabId.has(tabId)) {
    return stateByTabId.get(tabId);
  }

  const stored = await readStorage(getStorageKey(tabId));
  if (stored) {
    stateByTabId.set(tabId, stored);
    return stored;
  }

  const emptyState = createEmptyTabState(tabId);
  stateByTabId.set(tabId, emptyState);
  return emptyState;
}

async function persistTabState(tabId) {
  const state = stateByTabId.get(tabId);
  if (!state) {
    return;
  }

  await writeStorage(getStorageKey(tabId), state);
}

async function clearTabState(tabId) {
  stateByTabId.delete(tabId);
  await removeStorage(getStorageKey(tabId));
}

function serializeStateForPopup(state, clientStatus) {
  if (!state) {
    return {
      supported: false,
      detailPage: false,
      clientStatus
    };
  }

  return {
    supported: Boolean(state.siteKey),
    detailPage: state.detailPage,
    siteKey: state.siteKey,
    pageUrl: state.pageUrl,
    pageTitle: state.pageTitle,
    source: state.source,
    lastError: state.lastError,
    lastTaskResult: state.lastTaskResult,
    updatedAt: state.updatedAt,
    clientStatus
  };
}

async function upsertPageContext(tabId, payload) {
  const state = await getOrCreateTabState(tabId);
  state.siteKey = payload.siteKey || state.siteKey;
  state.pageUrl = payload.pageUrl || state.pageUrl;
  state.pageTitle = payload.pageTitle || state.pageTitle;
  state.detailPage = Boolean(payload.detailPage);
  state.updatedAt = Date.now();
  await persistTabState(tabId);
}

async function resolveDetailContext(tabId, hintedPageUrl = "") {
  const state = await getOrCreateTabState(tabId);
  const tab = await readTab(tabId);
  const candidates = [hintedPageUrl, state.pageUrl, tab?.url].filter(Boolean);

  for (const candidate of candidates) {
    const adapter = getAdapterByUrl(candidate);
    if (adapter && adapter.isDetailPage(candidate)) {
      if (tab?.title && !state.pageTitle) {
        state.pageTitle = tab.title;
      }

      return {
        adapter,
        pageUrl: candidate,
        pageTitle: state.pageTitle || tab?.title || ""
      };
    }
  }

  return {
    adapter: null,
    pageUrl: "",
    pageTitle: state.pageTitle || tab?.title || ""
  };
}

async function captureMasterPlaylist({ tabId, pageUrl, playlistUrl }) {
  const state = await getOrCreateTabState(tabId);
  const context = await resolveDetailContext(tabId, pageUrl);
  if (!context.adapter || !context.pageUrl) {
    return;
  }

  const hasSameSource = state.source?.masterUrl === playlistUrl;
  if (hasSameSource && (state.source?.parsing || state.source?.variants?.length)) {
    state.updatedAt = Date.now();
    await persistTabState(tabId);
    return;
  }

  state.siteKey = context.adapter.id;
  state.pageUrl = context.pageUrl;
  state.pageTitle = state.pageTitle || context.pageTitle;
  state.detailPage = true;
  state.lastError = "";
  state.updatedAt = Date.now();
  state.source = {
    masterUrl: playlistUrl,
    variants: state.source?.variants || [],
    parsing: true,
    capturedAt: Date.now()
  };
  await persistTabState(tabId);

  try {
    const variants = await fetchAndParseMasterPlaylist(playlistUrl, [
      context.pageUrl,
      context.adapter.getReferer()
    ]);
    state.source = {
      masterUrl: playlistUrl,
      variants,
      parsing: false,
      capturedAt: state.source.capturedAt
    };
  } catch (error) {
    if (state.source?.variants?.length) {
      state.source = {
        ...state.source,
        parsing: false
      };
      state.updatedAt = Date.now();
      await persistTabState(tabId);
      return;
    }

    state.lastError = error instanceof Error ? error.message : String(error);
    state.source = {
      masterUrl: playlistUrl,
      variants: [],
      parsing: false,
      capturedAt: state.source.capturedAt
    };
  }

  state.updatedAt = Date.now();
  await persistTabState(tabId);
}

function handlePlaylistRequest(details) {
  if (details.tabId < 0 || !details.url.includes("/playlist.m3u8")) {
    return;
  }

  const pageUrl = details.documentUrl || details.initiator || "";
  captureMasterPlaylist({
    tabId: details.tabId,
    pageUrl,
    playlistUrl: details.url
  });
}

async function buildPopupState(tab) {
  const state = tab?.id >= 0 ? await getOrCreateTabState(tab.id) : null;
  const adapter = getAdapterByUrl(tab?.url || "");
  if (tab?.id >= 0 && state && adapter) {
    state.siteKey = state.siteKey || adapter.id;
    state.pageUrl = state.pageUrl || tab.url || "";
    state.pageTitle = state.pageTitle || tab.title || "";
    state.detailPage = adapter.isDetailPage(tab.url || "");
    state.updatedAt = Date.now();
    await persistTabState(tab.id);
  }

  const clientStatus = await pingLocalClient();
  return serializeStateForPopup(state, clientStatus);
}

async function buildTabState(tabId) {
  if (tabId == null) {
    return {
      supported: false,
      detailPage: false,
      clientStatus: await pingLocalClient()
    };
  }

  const tab = await readTab(tabId);
  return buildPopupState(tab);
}

function createTaskPayload(state, variant) {
  const adapter = adapters.find((item) => item.id === state.siteKey) || missavAdapter;
  const originalTitle = state.pageTitle || adapter.getVideoCode(state.pageUrl, state.pageTitle);
  const filenameHint = adapter.formatTitle({
    pageTitle: state.pageTitle,
    url: state.pageUrl
  });
  const requestReferer = state.pageUrl || adapter.getReferer();
  const requestOrigin = (() => {
    try {
      return new URL(requestReferer).origin;
    } catch {
      return "https://missav.ws";
    }
  })();

  return {
    filename_hint: filenameHint,
    title: originalTitle,
    resolution: variant.resolution,
    m3u8_url: variant.url,
    page_url: state.pageUrl,
    referer: requestReferer,
    headers: {
      Referer: requestReferer,
      Origin: requestOrigin
    }
  };
}

async function handleAddTaskForState(state, variant, tabId) {
  const clientStatus = await pingLocalClient();
  if (!clientStatus.ok) {
    throw new Error("M3U8-Downloader is not running");
  }

  const taskPayload = createTaskPayload(state, variant);
  const data = await addTask(taskPayload);

  state.lastTaskResult = {
    ok: true,
    resolution: variant.resolution,
    variantUrl: variant.url,
    taskPayload,
    response: data,
    at: Date.now()
  };
  state.updatedAt = Date.now();
  await persistTabState(tabId);

  return {
    data,
    taskPayload
  };
}

chrome.webRequest.onBeforeRequest.addListener(handlePlaylistRequest, {
  urls: ["https://surrit.com/*/playlist.m3u8*"]
});

chrome.webRequest.onCompleted.addListener(handlePlaylistRequest, {
  urls: ["https://surrit.com/*/playlist.m3u8*"]
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabState(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearTabState(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "REGISTER_PAGE") {
    (async () => {
      if (sender.tab?.id >= 0) {
        await upsertPageContext(sender.tab.id, message.payload);
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "REPORT_M3U8_HINT") {
    (async () => {
      if (sender.tab?.id >= 0) {
        await captureMasterPlaylist({
          tabId: sender.tab.id,
          pageUrl: message.payload.pageUrl,
          playlistUrl: message.payload.masterUrl
        });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "REPORT_PLAYLIST_VARIANTS") {
    (async () => {
      if (sender.tab?.id != null) {
        const state = await getOrCreateTabState(sender.tab.id);
        state.siteKey = state.siteKey || "missav";
        state.pageUrl = message.payload.pageUrl || state.pageUrl;
        state.pageTitle = message.payload.pageTitle || state.pageTitle;
        state.detailPage = true;
        state.lastError = "";
        state.source = {
          masterUrl: message.payload.masterUrl,
          variants: message.payload.variants || [],
          parsing: false,
          capturedAt: Date.now()
        };
        state.updatedAt = Date.now();
        await persistTabState(sender.tab.id);
      }

      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "GET_POPUP_STATE") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const [activeTab] = tabs;
      const popupState = await buildPopupState(activeTab);
      sendResponse(popupState);
    });
    return true;
  }

  if (message?.type === "GET_TAB_STATE") {
    (async () => {
      const tabState = await buildTabState(sender.tab?.id);
      sendResponse(tabState);
    })();
    return true;
  }

  if (message?.type === "ADD_TASK") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const [activeTab] = tabs;
        if (activeTab?.id == null) {
          throw new Error("No active tab available");
        }

        const state = await getOrCreateTabState(activeTab?.id);
        if (!state?.source?.variants?.length) {
          throw new Error("No parsed stream variants available");
        }

        const variant = state.source.variants.find((item) => item.url === message.payload.variantUrl);
        if (!variant) {
          throw new Error("Selected variant was not found");
        }

        const result = await handleAddTaskForState(state, variant, activeTab.id);
        sendResponse({ ok: true, ...result });
      } catch (error) {
        const [activeTab] = tabs;
        if (activeTab?.id != null) {
          const state = await getOrCreateTabState(activeTab.id);
          state.lastTaskResult = {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            at: Date.now()
          };
          state.updatedAt = Date.now();
          await persistTabState(activeTab.id);
        }

        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    return true;
  }

  if (message?.type === "ADD_TASK_FOR_TAB") {
    (async () => {
      try {
        if (sender.tab?.id == null) {
          throw new Error("No sender tab available");
        }

        const state = await getOrCreateTabState(sender.tab.id);
        if (!state?.source?.variants?.length) {
          throw new Error("No parsed stream variants available");
        }

        const variant = state.source.variants.find((item) => item.url === message.payload.variantUrl);
        if (!variant) {
          throw new Error("Selected variant was not found");
        }

        const result = await handleAddTaskForState(state, variant, sender.tab.id);
        sendResponse({ ok: true, ...result });
      } catch (error) {
        if (sender.tab?.id != null) {
          const state = await getOrCreateTabState(sender.tab.id);
          state.lastTaskResult = {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            at: Date.now()
          };
          state.updatedAt = Date.now();
          await persistTabState(sender.tab.id);
        }

        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();
    return true;
  }

  if (message?.type === "OPEN_CLIENT_WINDOW") {
    (async () => {
      try {
        const clientStatus = await pingLocalClient();
        if (!clientStatus.ok) {
          throw new Error("M3U8-Downloader is not running");
        }

        const data = await openClientWindow();
        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();
    return true;
  }

  return false;
});
