const EXCLUDED_FIRST_SEGMENTS = new Set([
  "",
  "cn",
  "dm18",
  "genres",
  "makers",
  "actresses",
  "ranking",
  "tags",
  "search"
]);

const VIDEO_SLUG_PATTERN = /^[a-z]{2,10}-?\d{2,5}(?:-[a-z0-9]+)*$/i;
const VIDEO_CODE_EXTRACT_PATTERN = /[a-z]{2,10}-?\d{2,5}/i;

function safeUrl(input) {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function normalizePathname(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function getSlugFromUrl(url) {
  const parsed = safeUrl(url);
  if (!parsed) {
    return "";
  }

  const segments = normalizePathname(parsed.pathname)
    .split("/")
    .filter(Boolean);

  if (segments.length === 0) {
    return "";
  }

  if (segments.length === 1) {
    return segments[0];
  }

  if (segments[0] === "cn" && segments.length >= 2) {
    return segments[1];
  }

  return segments[segments.length - 1];
}

function cleanupTitle(rawTitle = "") {
  return rawTitle
    .replace(/\s*-\s*MissAV.*$/i, "")
    .replace(/\s*\|\s*MissAV.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getNormalizedSegments(url) {
  const parsed = safeUrl(url);
  if (!parsed || parsed.hostname !== "missav.ws") {
    return [];
  }

  return normalizePathname(parsed.pathname)
    .split("/")
    .filter(Boolean);
}

function isVideoSlug(slug) {
  return VIDEO_SLUG_PATTERN.test(slug);
}

export const missavAdapter = {
  id: "missav",
  label: "MissAV",
  matches(url) {
    const parsed = safeUrl(url);
    return Boolean(parsed && parsed.hostname === "missav.ws");
  },
  isDetailPage(url) {
    const segments = getNormalizedSegments(url);
    if (segments.length === 0) {
      return false;
    }

    if (segments.length === 1) {
      return isVideoSlug(segments[0]);
    }

    if (segments[0] === "cn" && segments.length >= 2) {
      return isVideoSlug(segments[1]);
    }

    if (EXCLUDED_FIRST_SEGMENTS.has(segments[0])) {
      return false;
    }

    return isVideoSlug(segments[segments.length - 1]);
  },
  getReferer() {
    return "https://missav.ws/";
  },
  getVideoCode(url, title = "") {
    const slug = getSlugFromUrl(url);
    const match = slug.match(VIDEO_CODE_EXTRACT_PATTERN);
    if (match) {
      return match[0].toLowerCase();
    }

    const titleMatch = title.match(VIDEO_CODE_EXTRACT_PATTERN);
    return titleMatch ? titleMatch[0].toLowerCase() : slug || "missav-video";
  },
  formatTitle({ pageTitle = "", url = "" }) {
    const cleaned = cleanupTitle(pageTitle);
    return cleaned || this.getVideoCode(url, pageTitle);
  }
};
