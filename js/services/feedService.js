// ============ FEED SERVICE - COMPLETE IMPLEMENTATION ==========

window.feedService = {
    async fetchFeed(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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