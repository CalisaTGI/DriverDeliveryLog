/**
 * Dynamically resolves API endpoints based on the accessing device's hostname.
 * This guarantees remote devices (e.g. mobile phones on http://192.168.x.x:5173)
 * talk to the backend on the same remote IP address rather than breaking on hardcoded 'localhost'.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // Use environment variable if specified
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}${cleanPath}`;
  }

  // Dynamically resolve server IP / hostname from current browser location
  if (typeof window !== "undefined" && window.location.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000${cleanPath}`;
  }

  return `http://localhost:5000${cleanPath}`;
}
