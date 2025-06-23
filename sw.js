// Import the version constant
importScripts('/config.js');


const CACHE_NAME = `spa-pwa-cache-v${APP_CONFIG.VERSION}`;


// Add this at the top of the file, after imports
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        // Immediately claim clients to take control
        self.clients.claim().then(() => {
            // Send a message back to inform the page
            self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({ type: 'SW_SKIPPED_WAITING' }));
            });
        });
    }
});


self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return Promise.all(
                    APP_CONFIG.CACHE_PATHS.map(url => {
                        return fetch(`${url}?ver=${APP_CONFIG.VERSION}`)
                            // ... rest of caching logic ...
                    })
                );
            })
    );
});


// Enhance the activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheName.includes(APP_CONFIG.VERSION)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // More aggressive client claiming
            return self.clients.claim();
        })
    );
});


self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    // Create a new URL to strip any version parameters
    const url = new URL(event.request.url);
    url.searchParams.delete('ver');
    const cacheUrl = url.toString();
    
    event.respondWith(
        caches.match(cacheUrl).then((cachedResponse) => {
            // Return cached response if found
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // Otherwise fetch from network
            return fetch(event.request).then((response) => {
                if (!response.ok || response.type !== 'basic') {
                    return response;
                }
                
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(cacheUrl, responseToCache);
                });
                
                return response;
            });
        })
    );
});


self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});