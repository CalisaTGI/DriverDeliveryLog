Implement offline mode / PWA support for this React application so that the app remains usable after closing the browser tab, refreshing, or losing network connectivity.

Requirements:

1. Detect whether this project uses Vite or Create React App by checking for `vite.config.js`/`vite.config.ts` vs `react-scripts` in package.json, and adapt the setup accordingly.

2. Install and configure a service worker using Workbox:
   - If Vite: install `vite-plugin-pwa` and configure it in `vite.config.js` with `registerType: 'autoUpdate'`, `workbox` options for runtime caching, and a `manifest` block.
   - If CRA: use the built-in `serviceWorkerRegistration.js` (eject or use `craco`/`cra-template-pwa` if not already present), and change `serviceWorkerRegistration.unregister()` to `serviceWorkerRegistration.register()` in `src/index.js`.

3. Configure caching strategy:
   - Precache all build assets (JS, CSS, HTML, fonts, icons) so the app shell loads with zero network.
   - Use `StaleWhileRevalidate` for API GET requests that should show cached data first and refresh in background.
   - Use `NetworkFirst` for API GET requests where fresh data is preferred but fallback to cache is acceptable offline.
   - Do NOT cache POST/PUT/DELETE requests; instead queue them.

4. Add a `manifest.json` (or `manifest.webmanifest`) with app name, short_name, icons (192x192 and 512x512), theme_color, background_color, `display: "standalone"`, and `start_url: "/"`.

5. Set up IndexedDB (using the `idb` npm package) as a data layer for:
   - Storing the last-known state of key app data (list the specific data types after inspecting the app, e.g. user profile, cached lists, form drafts).
   - Reading from IndexedDB first on app load, then reconciling with network data once online.

6. Implement Background Sync for any offline-created/edited data:
   - Queue failed mutating requests (POST/PUT/DELETE) in IndexedDB when offline.
   - Register a `sync` event in the service worker to replay queued requests once connectivity returns.
   - Use the Workbox `BackgroundSyncPlugin` if using Workbox, otherwise implement a manual queue with `navigator.onLine` + `online` event listener as a fallback for browsers without Background Sync API support.

7. Add an online/offline UI indicator:
   - A small banner or toast component that shows "You're offline — changes will sync when you're back online" using the `online`/`offline` window events.

8. Add a service worker update flow:
   - Detect when a new service worker version is available (`updatefound` event).
   - Show a "New version available, refresh to update" prompt instead of silently swapping content under the user.

9. Test and verify:
   - Confirm the app loads with DevTools Network set to "Offline" after first successful load.
   - Confirm closing the tab and reopening it (still offline) still renders the last cached state.
   - Confirm queued mutations replay correctly once network is restored.

10. Do not change any existing business logic, API contracts, or component behavior beyond what's needed to add caching/offline support. Keep changes isolated to: service worker registration/config, a new `src/offline/` (or similar) directory for IndexedDB and sync queue logic, and minimal wiring into `index.js`/`main.jsx` and the root App component for the online/offline indicator and update prompt.

After implementation, list every new file created, every existing file modified, and a summary of the caching strategy applied to each route/API endpoint.