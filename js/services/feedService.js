// ============ FEED SERVICE - COMPLETE IMPLEMENTATION ==========

window.feedService = {
    async fetchFeed(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);// ============ FEED SERVICE - WITH CORS PROXY FALLBACK CHAIN ==========

window.feedService = {

    // Public CORS proxies tried in order until one succeeds.
    // Add / remove entries here to adjust the chain.
    PROXIES: [
        // Local proxy (server-proxy.js — fastest, works when Node server is running)
        url => `http://localhost:8080/proxy?url=${encodeURIComponent(url)}`,

        // allorigins — returns JSON wrapper: { contents: "<xml>..." }
        url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,

        // corsproxy.io — transparent passthrough
        url => `https://corsproxy.io/?${encodeURIComponent(url)}`,

        // thingproxy — transparent passthrough
        url => `https://thingproxy.freeboard.io/fetch/${url}`,

        // cors-anywhere (Heroku demo — may require header click-through)
        url => `https://cors-anywhere.herokuapp.com/${url}`,

        // Direct fetch last (works if the server sends CORS headers itself)
        url => url,
    ],

    // Try each proxy in order, return first successful XML text
    async fetchWithProxyFallback(url) {
        for (const proxyFn of this.PROXIES) {
            const proxyUrl = proxyFn(url);
            try {
                console.log(`[feedService] Trying: ${proxyUrl}`);
                const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
                if (!res.ok) continue;

                const text = await res.text();

                // allorigins wraps the response in JSON { contents: "..." }
                if (proxyUrl.includes('allorigins.win')) {
                    try {
                        const json = JSON.parse(text);
                        if (json.contents) return json.contents;
                    } catch (_) { /* not JSON, fall through */ }
                }

                // Sanity-check: must look like XML
                if (text.includes('<rss') || text.includes('<feed') || text.includes('<item')) {
                    console.log(`[feedService] Success via: ${proxyUrl}`);
                    return text;
                }
            } catch (err) {
                console.warn(`[feedService] Proxy failed (${proxyUrl}):`, err.message);
            }
        }
        throw new Error('All CORS proxies exhausted — feed unavailable.');
    },

    async fetchFeed(url) {
        try {
            const text = await this.fetchWithProxyFallback(url);
            return this.parseFeed(text);
        } catch (error) {
            console.error('[feedService] fetchFeed failed:', error);
            return { success: false, error: error.message, episodes: [] };
        }
    },

    parseFeed(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');

        // Catch malformed XML
        const parseError = xml.querySelector('parsererror');
        if (parseError) {
            console.error('[feedService] XML parse error:', parseError.textContent);
            return { success: false, error: 'Invalid XML', episodes: [] };
        }

        const items = xml.querySelectorAll('item');
        const episodes = Array.from(items).map(item => {
            const title      = item.querySelector('title')?.textContent?.trim()   || 'Untitled';
            const link       = item.querySelector('link')?.textContent?.trim()    || '';
            const enclosure  = item.querySelector('enclosure')?.getAttribute('url') || '';
            const pubDate    = item.querySelector('pubDate')?.textContent?.trim() || '';
            const description= item.querySelector('description')?.textContent?.trim() || '';

            const episode = {
                title,
                link,
                description,
                pubDate,
                rawDate:  new Date(pubDate),
                videoUrl: transformVideoUrl(enclosure || link),
            };

            episode.id = generateStableEpisodeId(episode);
            return episode;
        });

        console.log(`[feedService] Parsed ${episodes.length} episodes.`);
        return { success: true, episodes };
    },
};
            const text = await response.text();
            return this.parseFeed(text);
        } catch (error) {
            console.error("Feed fetch failed:", error);
            return [];
        }
    },

    parseFeed(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "application/xml");
        const items = xml.querySelectorAll("item");
        
        return Array.from(items).map(item => {
            const title = item.querySelector("title")?.textContent || "Untitled";
            const link = item.querySelector("link")?.textContent || "";
            const enclosure = item.querySelector("enclosure")?.getAttribute("url") || "";
            const pubDate = item.querySelector("pubDate")?.textContent || "";
            
            const episode = {
                title: title,
                link: link,
                videoUrl: transformVideoUrl(enclosure),
                pubDate: pubDate,
                rawDate: new Date(pubDate)
            };
            
            // Assign a stable ID using the provided idGenerator.js
            episode.id = generateStableEpisodeId(episode);
            return episode;
        });
    }
};
