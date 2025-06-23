document.addEventListener('DOMContentLoaded', function() {



  class SimpleSPA {
        constructor() {
            this.APP_VERSION = APP_CONFIG.VERSION;
            this.CACHE_NAME = `spa-pwa-cache-v${this.APP_VERSION}`;
            this.pages = {
                page1: `/pages/page1.html`,
                page2: `/pages/page2.html`,
                page3: `/pages/page3.html`,
                page4: `/pages/page4.html`,
            };
            this.currentPage = null;
            this.isUpdateAvailable = false;
            
            // Initialize the app
            this.initServiceWorker();

            this.verifyCacheCompleteness();

            this.initNavigation();
            this.checkForUpdates();
        }

       async initServiceWorker() {
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register(
                        `/sw.js`, 
                        { scope: '/' }
                    );
                    
                    registration.addEventListener('updatefound', () => {
                        this.isUpdateAvailable = true;
                        this.showUpdateToast();
                    });
                    
                } catch (error) {
                    console.error('ServiceWorker registration failed:', error);
                }
            }
        }

        // Add this method to your SimpleSPA class
        async verifyCacheCompleteness() {
            if ('caches' in window) {
                try {
                    const cache = await caches.open(this.CACHE_NAME);
                    const cachedRequests = await cache.keys();
                    const cachedUrls = cachedRequests.map(request => new URL(request.url).pathname);
                    
                    const missingAssets = APP_CONFIG.CACHE_PATHS.filter(url => 
                        !cachedUrls.includes(url) && 
                        !cachedUrls.includes(`${url}?ver=${this.APP_VERSION}`)
                    );
                    
                    if (missingAssets.length > 0) {
                        console.log('Caching missing assets:', missingAssets);
                        await Promise.all(
                            missingAssets.map(url => 
                                fetch(`${url}?ver=${this.APP_VERSION}`)
                                    .then(response => {
                                        if (response.ok) {
                                            return cache.put(url, response);
                                        }
                                        throw new Error('Network response not ok');
                                    })
                                    .catch(err => {
                                        console.warn('Cache warm-up failed for:', url, err);
                                    })
                            )
                        );
                    }
                } catch (error) {
                    console.error('Cache verification failed:', error);
                }
            }
        }


        initNavigation() {
            // Handle initial page load based on hash
            window.addEventListener('load', () => {
                const hash = window.location.hash.substring(1) || 'page1';
                this.navigateTo(hash);
            });

            // Handle hash changes
            window.addEventListener('hashchange', () => {
                const hash = window.location.hash.substring(1);
                this.navigateTo(hash);
            });

            // Handle nav link clicks
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = e.target.getAttribute('href').substring(1);
                    this.navigateTo(page);
                });
            });
        }

        async navigateTo(page) {
            if (!this.pages[page]) {
                console.error(`Page ${page} not found`);
                return;
            }

            this.currentPage = page;
            history.replaceState(null, null, `#${page}`);
            await this.loadPage(page);
            this.updateActiveLink(page);
        }

        async loadPage(page) {
            try {
                // Add version parameter to bust cache
                const url = `${this.pages[page]}?ver=${this.APP_VERSION}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                
                const html = await response.text();
                document.getElementById('content').innerHTML = html;
              
                
                // Load page-specific stylesheet
                await this.loadPageStylesheet(page);
                
                // Initialize page-specific features
                this.initPageFeatures(page);
                
            } catch (error) {
                console.error('Error loading page:', error);
                document.getElementById('content').innerHTML = `
                    <h2>Error loading page</h2>
                    <p>${error.message}</p>
                `;
            }
        }


        updateActiveLink(activePage) {
            document.querySelectorAll('.nav-link').forEach(link => {
                const linkPage = link.getAttribute('href').substring(1);
                if (linkPage === activePage) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }

        async loadPageStylesheet(page) {
            // Remove any existing page-specific stylesheet
            const oldStyle = document.getElementById('page-specific-style');
            if (oldStyle) oldStyle.remove();
            
            // Create new link element for the page-specific stylesheet
            const link = document.createElement('link');
            link.href = `/styles/${page}.css?ver=${this.APP_VERSION}`;
            link.id = 'page-specific-style';
            link.rel = 'stylesheet';
            
            
            document.head.appendChild(link);
        }


        initPageFeatures(page) {
            // Initialize page-specific JavaScript here
            console.log(`Initializing features for ${page}`);
            
            // Example: Initialize a counter if we're on page1
            if (page === 'page1') {
                const counterElement = document.getElementById('counter');
                if (counterElement) {
                    let count = 0;
                    setInterval(() => {
                        count++;
                        counterElement.textContent = count;
                    }, 1000);
                }
            }
        }

        async checkForUpdates() {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                
                registration.addEventListener('updatefound', () => {
                    this.isUpdateAvailable = true;
                    this.showUpdateToast();
                });
                
                // Periodically check for updates (every 5 minutes)
                setInterval(async () => {
                    await registration.update();
                }, 5 * 60 * 1000);
            }
        }

        // In the showUpdateToast method of SimpleSPA class
        showUpdateToast() {
            if (!this.isUpdateAvailable) return;
            
            const toast = document.getElementById('toast');
            const refreshBtn = document.getElementById('refresh-btn');
            
            toast.style.display = 'block';
            
            refreshBtn.addEventListener('click', async () => {
                // Get the service worker registration
                const registration = await navigator.serviceWorker.getRegistration();
                
                if (registration && registration.waiting) {
                    // Send skip waiting message to the waiting service worker
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    
                    // Listen for the controllerchange event
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        // When the new service worker takes control, reload the page
                        window.location.reload();
                    });
                } else {
                    // Fallback if something went wrong
                    window.location.reload();
                }
            });
        }

    }

    // Initialize SPA
    window.spa = new SimpleSPA();

    // Warm up the cache by prefetching all pages
    window.addEventListener('load', () => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            Object.values(window.spa.pages).forEach(pageUrl => {
                fetch(pageUrl)
                    .then(res => {
                        if (!res.ok) throw new Error('Network response was not ok');
                        return caches.open(window.spa.CACHE_NAME)
                            .then(cache => cache.put(pageUrl, res));
                    })
                    .catch(err => console.log('Prefetch failed:', err));
            });
        }
    });

});