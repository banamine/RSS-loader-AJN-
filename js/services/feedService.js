window.feedService = {
    async fetchFeed() {
        try {
            const response = await fetch(window.APP_CONFIG.feedUrl);
            if (!response.ok) throw new Error("Network response was not ok");
            return await response.text();
        } catch (error) {
            console.error("Feed fetch failed:", error);
            return null;
        }
    },
    parseEpisodes(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "application/xml");
        const items = xml.querySelectorAll("item");
        return Array.from(items).map(item => ({
            title: item.querySelector("title")?.textContent || "Untitled",
            url: item.querySelector("enclosure")?.getAttribute("url") || "",
            pubDate: item.querySelector("pubDate")?.textContent || ""
        }));
    }
};