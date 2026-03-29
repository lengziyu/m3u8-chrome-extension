(function pageBridge() {
  const REQUEST_TYPE = "M3U8_DOWNLOADER_FETCH_MASTER_PLAYLIST";
  const RESPONSE_TYPE = "M3U8_DOWNLOADER_FETCH_MASTER_PLAYLIST_RESULT";

  window.addEventListener("message", async (event) => {
    if (event.source !== window || !event.data || event.data.type !== REQUEST_TYPE) {
      return;
    }

    const { requestId, masterUrl } = event.data;

    try {
      const response = await fetch(masterUrl, {
        headers: {
          Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, text/plain"
        },
        credentials: "omit"
      });

      const content = await response.text();
      window.postMessage({
        type: RESPONSE_TYPE,
        requestId,
        ok: response.ok,
        status: response.status,
        content
      }, "*");
    } catch (error) {
      window.postMessage({
        type: RESPONSE_TYPE,
        requestId,
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : String(error)
      }, "*");
    }
  });
}());
