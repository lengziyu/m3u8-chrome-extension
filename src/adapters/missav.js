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

  return getDetailSlugCandidate(segments) || segments[segments.length - 1];
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

function getDetailSlugCandidate(segments) {
  return [...segments].reverse().find((segment) => isVideoSlug(segment)) || "";
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
    return Boolean(getDetailSlugCandidate(segments));
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
