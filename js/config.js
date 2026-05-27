// ============ FEED SERVICE - WITH DEBUG LOGGING ==========

class FeedService {
    constructor() {
        this.abortController = null;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
    }
    
    static get XSLT() {
        return `<?xml version="1.0" encoding="UTF-8"?>
        <xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
            <xsl:output method="xml" indent="yes"/>
            <xsl:template match="/">
                <feed>
                    <channel>
                        <title><xsl:value-of select="/rss/channel/title"/></title>
                        <description><xsl:value-of select="/rss/channel/description"/></description>
                        <link><xsl:value-of select="/rss/channel/link"/></link>
                        <lastBuildDate><xsl:value-of select="/rss/channel/lastBuildDate"/></lastBuildDate>
                    </channel>
                    <items>
                        <xsl:for-each select="/rss/channel/item">
                            <item>
                                <title><xsl:value-of select="title"/></title>
                                <link><xsl:value-of select="link"/></link>
                                <description><xsl:value-of select="description"/></description>
                                <pubDate><xsl:value-of select="pubDate"/></pubDate>
                                <guid><xsl:value-of select="guid"/></guid>
                                <enclosure url="{enclosure/@url}" type="{enclosure/@type}" length="{enclosure/@length}"/>
                            </item>
                        </xsl:for-each>
                    </items>
                </feed>
            </xsl:template>
        </xsl:stylesheet>`;
    }
    
    processEpisode(item, index) {
        const videoUrl = this.extractVideoUrl(item);
        const stableId = generateStableEpisodeId({
            videoUrl: videoUrl,
            link: item.link,
            title: item.title,
            pubDate: item.pubDate
        });
        return {
            id: stableId,
            originalIndex: index,
            title: item.title || 'Untitled Episode',
            description: item.description ? item.description.replace(/<[^>]*>/g, '') : 'No description',
            link: item.link || '',
            pubDate: item.pubDate || '',
            videoUrl: videoUrl,
            enclosure: item.enclosure
        };
    }
    
    extractVideoUrl(item) {
        if (item.link && (item.link.includes('.m4v') || item.link.includes('.mp4'))) return item.link;
        if (item.enclosure?.url) return item.enclosure.url;
        if (item.guid && (item.guid.includes('.m4v') || item.guid.includes('.mp4'))) return item.guid;
        return item.link || '';
    }
    
    async fetchFeed(url, options = { forceRefresh: false }) {
        // Check cache
        if (!options.forceRefresh && this.cache.has(url)) {
            const cached = this.cache.get(url);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('Using cached feed data');
                return cached.data;
            }
        }
        
        // Cancel previous request
        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();
        
        try {
            console.log(`📡 Fetching feed from: ${url}`);
            
            const response = await fetch(url, {
                signal: this.abortController.signal,
                headers: { 
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            
            // ============ CRITICAL DEBUG LOGGING ============
            console.log("🔍 === DEBUG: RAW FEED DATA ===");
            console.log(`📊 Response status: ${response.status}`);
            console.log(`📋 Content-Type: ${response.headers.get('content-type')}`);
            console.log(`📏 Data length: ${text.length} characters`);
            console.log("📄 First 500 characters:");
            console.log("┌─────────────────────────────────────────");
            console.log(text.substring(0, 500));
            console.log("└─────────────────────────────────────────");
            
            // Check if response looks like RSS/XML
            const hasXmlTag = text.includes("<?xml");
            const hasRssTag = text.includes("<rss");
            const hasHtmlTag = text.includes("<!DOCTYPE html") || text.includes("<html");
            
            console.log(`✅ Has XML tag: ${hasXmlTag}`);
            console.log(`✅ Has RSS tag: ${hasRssTag}`);
            console.log(`❌ Has HTML tag: ${hasHtmlTag}`);
            
            if (hasHtmlTag) {
                console.error("❌ ERROR: Server returned HTML instead of RSS!");
                console.error("   This usually means:");
                console.error("   1. The RSS feed URL is incorrect");
                console.error("   2. The server is blocking the request");
                console.error("   3. Need to use a CORS proxy");
                throw new Error("Server returned HTML - RSS feed may be blocked or URL is incorrect");
            }
            
            if (!hasXmlTag && !hasRssTag) {
                console.error("❌ ERROR: Data does not contain RSS/XML tags!");
                throw new Error("Invalid RSS/XML format - no XML or RSS tags found");
            }
            
            console.log("✅ Data appears to be valid RSS/XML!");
            console.log("=====================================\n");
            
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            
            // Check for parse errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                console.error("❌ XML Parse Error:", parseError.textContent);
                throw new Error('XML parsing failed: ' + parseError.textContent);
            }
            
            // Apply XSLT transformation
            const xsltDoc = parser.parseFromString(FeedService.XSLT, 'text/xml');
            const xsltError = xsltDoc.querySelector('parsererror');
            if (xsltError) {
                console.error("❌ XSLT Parse Error:", xsltError.textContent);
                throw new Error('XSLT parsing failed: ' + xsltError.textContent);
            }
            
            const processor = new XSLTProcessor();
            processor.importStylesheet(xsltDoc);
            const resultDoc = processor.transformToDocument(xmlDoc);
            
            // Convert to JSON
            const jsonResult = this.xmlToJson(resultDoc);
            const episodes = this.extractEpisodes(jsonResult);
            const processedEpisodes = episodes.map((ep, idx) => this.processEpisode(ep, idx));
            
            const result = { 
                success: true, 
                episodes: processedEpisodes, 
                total: processedEpisodes.length, 
                timestamp: Date.now(), 
                url: url 
            };
            
            // Cache result
            this.cache.set(url, { data: result, timestamp: Date.now() });
            
            console.log(`✅ Success! Parsed ${processedEpisodes.length} episodes`);
            return result;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Feed fetch aborted');
                return { success: false, error: 'Request cancelled', aborted: true };
            }
            
            console.error('❌ Feed fetch failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    xmlToJson(xml) {
        let obj = {};
        
        if (xml.nodeType === 1) {
            if (xml.attributes.length > 0) {
                obj["@attributes"] = {};
                for (let j = 0; j < xml.attributes.length; j++) {
                    const attr = xml.attributes.item(j);
                    obj["@attributes"][attr.nodeName] = attr.nodeValue;
                }
            }
        } else if (xml.nodeType === 3) {
            obj = xml.nodeValue.trim();
        }
        
        if (xml.hasChildNodes()) {
            for (let i = 0; i < xml.childNodes.length; i++) {
                const item = xml.childNodes.item(i);
                const nodeName = item.nodeName;
                
                if (typeof obj[nodeName] === "undefined") {
                    obj[nodeName] = this.xmlToJson(item);
                } else {
                    if (typeof obj[nodeName].push === "undefined") {
                        const old = obj[nodeName];
                        obj[nodeName] = [];
                        obj[nodeName].push(old);
                    }
                    obj[nodeName].push(this.xmlToJson(item));
                }
            }
        }
        
        return obj;
    }
    
    extractEpisodes(jsonResult) {
        try {
            if (jsonResult && jsonResult.feed && jsonResult.feed.items && jsonResult.feed.items.item) {
                const items = jsonResult.feed.items.item;
                return Array.isArray(items) ? items : [items];
            }
            return [];
        } catch (error) {
            console.error('Failed to extract episodes:', error);
            return [];
        }
    }
    
    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
    
    clearCache() {
        this.cache.clear();
    }
}

// Create global instance
const feedService = new FeedService();
window.feedService = feedService;
