// ============ FEED SERVICE - WITH STABLE IDS ==========
import { generateStableEpisodeId } from '../utils/idGenerator.js';

export class FeedService {
    constructor() {
        this.abortController = null;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
    }
    
    // ... XSLT property remains the same ...
    
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
    
    // Process raw episode with stable ID
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
        // Try to get video URL from various possible locations
        if (item.link && (item.link.includes('.m4v') || item.link.includes('.mp4'))) {
            return item.link;
        }
        if (item.enclosure?.url) {
            return item.enclosure.url;
        }
        if (item.guid && (item.guid.includes('.m4v') || item.guid.includes('.mp4'))) {
            return item.guid;
        }
        return item.link || '';
    }
    
    // Rest of feedService methods remain the same...
    async fetchFeed(url, options = { forceRefresh: false }) {
        // Check cache
        if (!options.forceRefresh && this.cache.has(url)) {
            const cached = this.cache.get(url);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('Using cached feed data');
                return cached.data;
            }
        }
        
        if (this.abortController) {
            this.abortController.abort();
        }
        
        this.abortController = new AbortController();
        
        try {
            const response = await fetch(url, {
                signal: this.abortController.signal,
                headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const xmlText = await response.text();
            
            if (!xmlText.includes('<rss') && !xmlText.includes('<feed')) {
                throw new Error('Invalid RSS/XML format');
            }
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing failed: ' + parseError.textContent);
            }
            
            const xsltDoc = parser.parseFromString(FeedService.XSLT, 'text/xml');
            const processor = new XSLTProcessor();
            processor.importStylesheet(xsltDoc);
            const resultDoc = processor.transformToDocument(xmlDoc);
            
            const jsonResult = this.xmlToJson(resultDoc);
            const episodes = this.extractEpisodes(jsonResult);
            
            // Process episodes with stable IDs
            const processedEpisodes = episodes.map((ep, idx) => this.processEpisode(ep, idx));
            
            const result = {
                success: true,
                episodes: processedEpisodes,
                total: processedEpisodes.length,
                timestamp: Date.now(),
                url: url
            };
            
            this.cache.set(url, { data: result, timestamp: Date.now() });
            
            return result;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Feed fetch aborted');
                return { success: false, error: 'Request cancelled', aborted: true };
            }
            
            console.error('Feed fetch failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ... xmlToJson, extractEpisodes, abort, clearCache methods remain ...
    
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

export const feedService = new FeedService();