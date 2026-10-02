export function normalizeAppDeepLink(value?: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const raw = value.trim();
  let path = raw;

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      const url = new URL(raw);

      if (/^https?:\/\//i.test(raw)) {
        path = url.pathname;
      } else {
        const schemePath = [url.hostname, url.pathname.replace(/^\/+/, "")]
          .filter(Boolean)
          .join("/");

        path = schemePath ? `/${schemePath}` : url.pathname;
      }
    }
  } catch {
    path = raw;
  }

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  const ownerApplications = path.match(/^\/adoptions\/([^/]+)\/applications\/?$/);

  if (ownerApplications?.[1]) {
    return `/my-adoption-listings/${ownerApplications[1]}/applications`;
  }

  if (/^\/my-adoption-listings\/[^/]+\/applications\/?$/.test(path)) {
    return path.replace(/\/$/, "");
  }

  if (/^\/my-adoption-applications\/?$/.test(path)) {
    return "/my-adoption-applications";
  }

  if (/^\/my-adoption-applications\/[^/]+\/?$/.test(path)) {
    return path.replace(/\/$/, "");
  }

  if (/^\/adopt\/[^/]+\/?$/.test(path)) {
    return path.replace(/\/$/, "");
  }

  if (/^\/chat\/[^/]+\/?$/.test(path)) {
    return path.replace(/\/$/, "");
  }

  if (/^\/adoption-chat\/[^/]+\/?$/.test(path)) {
    return path.replace(/\/$/, "");
  }

  if (/^\/pets\/[^/]+\/?$/.test(path)) {
    return path.replace(/\/$/, "");
  }

  if (/^\/reports\/create\/?$/.test(path)) {
    return "/reports/create";
  }

  if (
    /^\/\(tabs\)(?:\/(?:add-pet|adopt|index|matches|my-pets|notifications|profile|settings|swipe))?\/?$/.test(
      path,
    )
  ) {
    return path.replace(/\/$/, "");
  }

  return null;
}
