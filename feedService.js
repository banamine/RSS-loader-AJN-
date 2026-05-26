// ============ FEED SERVICE ============
// Handles RSS feed fetching and processing with worker integration

import { getWorkerManager } from '../utils/xsltWorkerManager.js';
import { sanitizeEpisodeData } from '../utils/xmlToJson.js';
import { showToast } from '../utils/helpers.js';

const XSLT_TRANSFORM = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="xml" indent="yes"/>
    
    <xsl:template match="/">
        <rss>
            <channel>
                <xsl:copy-of select="/rss/channel/title"/>
                <xsl:copy-of select="/rss/channel/description"/>
                <xsl:copy-of select="/rss/channel/link"/>
                <xsl:copy-of select="/rss/channel/lastBuildDate"/>
                <xsl:for-each select="/rss/channel/item">
                    <item>
                        <title><xsl:value-of select="title"/></title>
                        <link><xsl:value-of select="link"/></link>
                        <description><xsl:value-of select="description"/></description>
                        <pubDate><xsl:value-of select="pubDate"/></pubDate>
                        <guid><xsl:value-of select="guid"/></guid>
                        <enclosure>
                            <xsl:attribute name="url">
                                <xsl:value-of select="enclosure/@url"/>
                            </xsl:attribute>
                            <xsl:attribute name="type">
                                <xsl:value-of select="enclosure/@type"/>
                            </xsl:attribute>
                            <xsl:attribute name="length">
                                <xsl:value-of select="enclosure/@length"/>
                            </xsl:attribute>
                        </enclosure>
                    </item>
                </xsl:for-each>
            </channel>
        </rss>
    </xsl:template>
</xsl:stylesheet>`;

export class FeedService {
    constructor() {
        this.workerManager = getWorkerManager();
        this.abortController = null;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    async fetchFeed(url, options = {}) {
        const { forceRefresh = false, useCache = true } = options;
        
        // Check cache
        if (useCache && !forceRefresh) {
            const cached = this.cache.get(url);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                console.log('Using cached feed data');
                return cached.data;
            }
        }
        
        // Cancel previous request if exists
        if (this.abortController) {
            this.abortController.abort();
        }
        
        this.abortController = new AbortController();
        
        try {
            // Fetch RSS feed
            const response = await fetch(url, {
                signal: this.abortController.signal,
                headers: {
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const xmlText = await response.text();
            
            // Validate XML
            if (!xmlText.includes('<rss') && !xmlText.includes('<feed')) {
                throw new Error('Invalid RSS/XML format');
            }
            
            // Process with worker
            const workerResult = await this.workerManager.transformFeed(xmlText, XSLT_TRANSFORM, {
                useChunking: options.useChunking !== false
            });
            
            if (!workerResult.success) {
                throw new Error(workerResult.error || 'Worker transformation failed');
            }
            
            // Process episodes
            let episodes = [];
            if (workerResult.episodes) {
                episodes = workerResult.episodes.map(sanitizeEpisodeData);
            } else if (workerResult.chunks) {
                // Handle chunked response
                episodes = workerResult.chunks.flat();
            }
            
            const result = {
                success: true,
                episodes: episodes,
                total: episodes.length,
                timestamp: Date.now(),
                url: url
            };
            
            // Cache result
            if (useCache) {
                this.cache.set(url, { data: result, timestamp: Date.now() });
            }
            
            return result;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Feed fetch aborted');
                return { success: false, error: 'Request cancelled', aborted: true };
            }
            
            console.error('Feed fetch failed:', error);
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    async fetchFeedWithProgress(url, onProgress, options = {}) {
        if (!onProgress) {
            return this.fetchFeed(url, options);
        }
        
        // Cancel previous request
        if (this.abortController) {
            this.abortController.abort();
        }
        
        this.abortController = new AbortController();
        
        try {
            onProgress({ type: 'start', message: 'Fetching feed...' });
            
            const response = await fetch(url, {
                signal: this.abortController.signal
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            onProgress({ type: 'fetch', message: 'Parsing XML...' });
            
            const xmlText = await response.text();
            
            onProgress({ type: 'parse', message: 'Transforming data...' });
            
            // Set up chunked response handling
            const transformPromise = new Promise((resolve, reject) => {
                let allEpisodes = [];
                let totalChunks = 0;
                let receivedChunks = 0;
                
                const messageHandler = (e) => {
                    const { type, data } = e.data;
                    
                    if (type === 'metadata') {
                        onProgress({ type: 'metadata', total: data.total });
                    } else if (type === 'chunk') {
                        const chunkEpisodes = data.chunk.map(sanitizeEpisodeData);
                        allEpisodes.push(...chunkEpisodes);
                        receivedChunks++;
                        
                        onProgress({
                            type: 'chunk',
                            progress: receivedChunks / data.totalChunks,
                            chunkIndex: data.chunkIndex,
                            totalChunks: data.totalChunks,
                            episodesSoFar: allEpisodes.length
                        });
                        
                        if (data.isLastChunk) {
                            this.workerManager.worker.removeEventListener('message', messageHandler);
                            resolve({
                                success: true,
                                episodes: allEpisodes,
                                total: allEpisodes.length
                            });
                        }
                    } else if (type === 'complete') {
                        this.workerManager.worker.removeEventListener('message', messageHandler);
                        resolve({
                            success: true,
                            episodes: data.episodes.map(sanitizeEpisodeData),
                            total: data.episodes.length
                        });
                    } else if (type === 'error') {
                        this.workerManager.worker.removeEventListener('message', messageHandler);
                        reject(new Error(data.error));
                    }
                };
                
                this.workerManager.worker.addEventListener('message', messageHandler);
                
                // Start transformation
                this.workerManager.sendMessage('transform', {
                    xmlText,
                    xsltText: XSLT_TRANSFORM,
                    useChunking: true
                }).catch(reject);
            });
            
            const result = await transformPromise;
            
            onProgress({ type: 'complete', total: result.episodes.length });
            
            // Cache result
            this.cache.set(url, {
                data: { ...result, timestamp: Date.now(), url },
                timestamp: Date.now()
            });
            
            return result;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                onProgress({ type: 'abort', message: 'Request cancelled' });
                return { success: false, error: 'Request cancelled', aborted: true };
            }
            
            onProgress({ type: 'error', message: error.message });
            return { success: false, error: error.message };
        }
    }
    
    clearCache(url = null) {
        if (url) {
            this.cache.delete(url);
        } else {
            this.cache.clear();
        }
    }
    
    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
}

// Singleton instance
let feedServiceInstance = null;

export function getFeedService() {
    if (!feedServiceInstance) {
        feedServiceInstance = new FeedService();
    }
    return feedServiceInstance;
}