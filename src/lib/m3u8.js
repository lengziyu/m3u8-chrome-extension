function toAbsoluteUrl(baseUrl, maybeRelativeUrl) {
  try {
    return new URL(maybeRelativeUrl, baseUrl).toString();
  } catch {
    return maybeRelativeUrl;
  }
}

function parseAttributes(line) {
  const attributes = {};
  const raw = line.split(":")[1] || "";
  const parts = raw.match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g) || [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || value == null) {
      continue;
    }

    attributes[key.trim().toUpperCase()] = value.replace(/^['"]|['"]$/g, "").trim();
  }

  return attributes;
}

export function parseMasterPlaylist(content, masterUrl) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const variants = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("#EXT-X-STREAM-INF")) {
      continue;
    }

    const nextLine = lines[index + 1];
    if (!nextLine || nextLine.startsWith("#")) {
      continue;
    }

    const attributes = parseAttributes(line);
    const resolution = attributes.RESOLUTION || "Unknown";
    const bandwidth = Number.parseInt(attributes.BANDWIDTH || "0", 10) || 0;

    variants.push({
      bandwidth,
      resolution,
      url: toAbsoluteUrl(masterUrl, nextLine)
    });
  }

  return variants.sort((left, right) => {
    const [leftWidth = 0, leftHeight = 0] = left.resolution.split("x").map(Number);
    const [rightWidth = 0, rightHeight = 0] = right.resolution.split("x").map(Number);
    const leftPixels = leftWidth * leftHeight;
    const rightPixels = rightWidth * rightHeight;

    if (rightPixels !== leftPixels) {
      return rightPixels - leftPixels;
    }

    return right.bandwidth - left.bandwidth;
  });
}

async function fetchPlaylistWithReferrer(masterUrl, referrer = "") {
  const options = {
    headers: {
      Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, text/plain"
    }
  };

  if (referrer) {
    options.referrer = referrer;
    options.referrerPolicy = "unsafe-url";
  }

  return fetch(masterUrl, options);
}

export async function fetchAndParseMasterPlaylist(masterUrl, referrers = []) {
  const candidates = [...new Set(referrers.filter(Boolean))];
  candidates.push("");

  let lastError = null;
  for (const referrer of candidates) {
    const response = await fetchPlaylistWithReferrer(masterUrl, referrer);
    if (!response.ok) {
      lastError = new Error(`Failed to fetch playlist: ${response.status}`);
      continue;
    }

    const content = await response.text();
    const variants = parseMasterPlaylist(content, masterUrl);

    if (variants.length === 0) {
      throw new Error("No stream variants found in master playlist");
    }

    return variants;
  }

  throw lastError || new Error("Failed to fetch playlist");
}
