const API_BASE = "http://127.0.0.1:38427";

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractApiError(data, fallbackMessage) {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (data.ok === false) {
      return fallbackMessage;
    }
  }

  return fallbackMessage;
}

export async function pingLocalClient() {
  try {
    const response = await fetch(`${API_BASE}/ping`, {
      method: "GET"
    });

    return {
      ok: response.ok,
      status: response.status,
      data: await parseJsonResponse(response)
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function addTask(payload) {
  const response = await fetch(`${API_BASE}/add-task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(extractApiError(data, `Add task failed: ${response.status}`));
  }

  if (data && typeof data === "object" && data.ok === false) {
    throw new Error(extractApiError(data, "Add task rejected by local client"));
  }

  return data;
}

export async function openClientWindow() {
  const response = await fetch(`${API_BASE}/open-window`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source: "chrome-extension"
    })
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(extractApiError(data, `Open window failed: ${response.status}`));
  }

  if (data && typeof data === "object" && data.ok === false) {
    throw new Error(extractApiError(data, "Open window rejected by local client"));
  }

  return data;
}
