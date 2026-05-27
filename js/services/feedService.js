// ============ FEED SERVICE - PLAIN OBJECT, NO IMPORTS/EXPORTS ==========

const feedService = {
    // Cache for feed data
    cache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    
    // Fetch RSS feed using CORS proxy
    fetchFeed: async function(url, options = {}) {
        // Check cache
        if (!options.forceRefresh && this.cache.has(url)) {
            const cached = this.cache.get(url);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📦 Using cached feed data');
                return cached.data;
            }
        }
        
        try {
            console.log(`📡 Fetching feed: ${url}`);
            
            // Use multiple CORS proxies (fallback)
            const proxies = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
                `https://cors-anywhere.herokuapp.com/${url}`
            ];
            
            let data = null;
            let lastError = null;
            
            // Try each proxy until one works
            for (const proxyUrl of proxies) {
                try {
                    console.log(`  Trying proxy: ${proxyUrl.substring(0, 50)}...`);
                    const response = await fetch(proxyUrl);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const result = await response.json();
                    
                    // Handle different proxy response formats
                    if (result.contents) {
                        // api.allorigins.win format
                        data = result.contents;
                    } else if (result.status === 'success' && result.data) {
                        // api.codetabs.com format
                        data = result.data;
                    } else if (typeof result === 'string') {
                        // Direct response
                        data = result;
                    } else if (result.responseText) {
                        data = result.responseText;
                    }
                    
                    if (data && (data.includes('<rss') || data.includes('<?xml'))) {
                        console.log('  ✅ Proxy successful!');
                        break;
                    }
                } catch (err) {
                    console.warn(`  ❌ Proxy failed: ${err.message}`);
                    lastError = err;
                    continue;
                }
            }
            
            if (!data) {
                throw new Error(lastError?.message || 'All proxies failed');
            }
            
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, 'text/xml');
            
            // Check for parse errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing failed: ' + parseError.textContent);
            }
            
            // Cache the result
            const result = {
                success: true,
                xmlDoc: xmlDoc,
                timestamp: Date.now(),
                url: url
            };
            
            this.cache.set(url, { data: result, timestamp: Date.now() });
            
            console.log(`✅ Feed fetched successfully`);
            return result;
            
        } catch (error) {
            console.error('❌ Feed fetch failed:', error);
            return {
                success: false,
                error: error.message,
                url: url
            };
        }
    },
    
    // Extract episodes from XML document
    extractEpisodes: function(xmlDoc) {
        if (!xmlDoc) return [];
        
        const items = xmlDoc.querySelectorAll('item');
        const episodes = [];
        
        items.forEach((item, index) => {
            const title = item.querySelector('title')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';
            const enclosure = item.querySelector('enclosure');
            
            let videoUrl = link;
            if (enclosure && enclosure.getAttribute('url')) {
                videoUrl = enclosure.getAttribute('url');
            }
            
            episodes.push({
                id: `ep_${index}_${Date.now()}`,
                title: title,
                description: description,
                link: link,
                pubDate: pubDate,
                videoUrl: videoUrl,
                enclosure: enclosure ? {
                    url: enclosure.getAttribute('url'),
                    type: enclosure.getAttribute('type'),
                    length: enclosure.getAttribute('length')
                } : null
            });
        });
        
        return episodes;
    },
    
    // Clear cache
    clearCache: function() {
        this.cache.clear();
        console.log('Cache cleared');
    }
};

// Make available globally
window.feedService = feedService;