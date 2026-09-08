/**
 * Dynamically resolves API endpoints based on the accessing device's environment.
 * In development and cloud environments like GitHub Codespaces, relative paths
 * ('/api/...') are preferred so requests route cleanly through the Vite dev proxy
 * to backend port 5000 on the same origin.
 * This prevents CORS errors, port mismatch 404s, and auth redirects across port subdomains.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // 1. Explicit API URL from environment variable
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}${cleanPath}`;
  }

  if (typeof window !== "undefined" && window.location.hostname) {
    const hostname = window.location.hostname;

    // 2. GitHub Codespaces / Gitpod / Cloud IDEs:
    // In Codespaces, ports have separate subdomains (e.g. *-5173.app.github.dev).
    // Direct requests to :5000 break because Codespace proxy ingress only listens on 443.
    // Using relative path routes cleanly through the Vite proxy on the same origin.
    const isCloudEnv =
      hostname.endsWith(".app.github.dev") ||
      hostname.endsWith(".githubpreview.dev") ||
      hostname.endsWith(".gitpod.io") ||
      hostname.includes("codespaces");

    if (isCloudEnv) {
      return cleanPath;
    }

    // 3. Vite development mode (localhost or LAN devices like 192.168.x.x):
    // Vite proxy handles forwarding /api to http://127.0.0.1:5000 without CORS issues.
    if (import.meta.env.DEV) {
      return cleanPath;
    }

    // 4. Standalone production fallback if hostname is available
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:5000${cleanPath}`;
  }

  return cleanPath;
}

