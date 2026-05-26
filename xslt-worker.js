// ============ XSLT WEB WORKER ============
// This worker processes XML feed data on a separate thread
// No DOM access here - pure data transformation

// Helper: Convert XML node to JSON object safely
function xmlNodeToJson(node) {
    const obj = {};
    
    // Handle element nodes
    if (node.nodeType === 1) { // ELEMENT_NODE
        // Process attributes
        if (node.attributes && node.attributes.length > 0) {
            for (let i = 0; i < node.attributes.length; i++) {
                const attr = node.attributes[i];
                obj[`@${attr.name}`] = attr.value;
            }
        }
        
        // Process child nodes
        if (node.hasChildNodes()) {
            for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                const childName = child.nodeName;
                
                if (child.nodeType === 3) { // TEXT_NODE
                    const text = child.nodeValue.trim();
                    if (text) {
                        return text; // Return text directly for leaf nodes
                    }
                } else if (child.nodeType === 1) { // ELEMENT_NODE
                    const childObj = xmlNodeToJson(child);
                    
                    if (obj[childName]) {
                        // Handle multiple elements with same name
                        if (Array.isArray(obj[childName])) {
                            obj[childName].push(childObj);
                        } else {
                            obj[childName] = [obj[childName], childObj];
                        }
                    } else {
                        obj[childName] = childObj;
                    }
                }
            }
        }
    }
    
    return Object.keys(obj).length === 0 ? null : obj;
}

// Convert entire XML document to JSON
function xmlToJson(xmlDoc) {
    const root = xmlDoc.documentElement;
    if (!root) return null;
    
    const result = {
        nodeName: root.nodeName,
        attributes: {},
        children: []
    };
    
    // Process root attributes
    if (root.attributes && root.attributes.length > 0) {
        for (let i = 0; i < root.attributes.length; i++) {
            const attr = root.attributes[i];
            result.attributes[attr.name] = attr.value;
        }
    }
    
    // Process root children
    if (root.hasChildNodes()) {
        for (let i = 0; i < root.childNodes.length; i++) {
            const child = root.childNodes[i];
            if (child.nodeType === 1) { // ELEMENT_NODE
                result.children.push(xmlNodeToJson(child));
            }
        }
    }
    
    return result;
}

// Transform XML with XSLT and return structured data
function transformWithXslt(xmlText, xsltText) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        // Check for XML parse errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML parsing failed: ' + parseError.textContent);
        }
        
        const xsltDoc = parser.parseFromString(xsltText, "text/xml");
        const xsltError = xsltDoc.querySelector('parsererror');
        if (xsltError) {
            throw new Error('XSLT parsing failed: ' + xsltError.textContent);
        }
        
        // Apply XSLT transformation
        const processor = new XSLTProcessor();
        processor.importStylesheet(xsltDoc);
        const resultDoc = processor.transformToDocument(xmlDoc);
        
        // Convert transformed document to JSON
        const jsonResult = xmlToJson(resultDoc);
        
        // Extract episode items from RSS structure
        let episodes = [];
        
        if (jsonResult && jsonResult.children) {
            // Find the channel node
            const channel = jsonResult.children.find(c => c.nodeName === 'channel');
            if (channel && channel.children) {
                // Extract all item nodes
                episodes = channel.children
                    .filter(c => c.nodeName === 'item')
                    .map(item => ({
                        title: item.title || '',
                        link: item.link || '',
                        description: item.description || '',
                        pubDate: item.pubDate || '',
                        guid: item.guid || '',
                        enclosure: item.enclosure ? {
                            url: item.enclosure['@url'],
                            type: item.enclosure['@type'],
                            length: item.enclosure['@length']
                        } : null
                    }));
            }
        }
        
        return {
            success: true,
            episodes: episodes,
            total: episodes.length,
            timestamp: Date.now()
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            timestamp: Date.now()
        };
    }
}

// Chunk large episode arrays for progressive rendering
function chunkEpisodes(episodes, chunkSize = 50) {
    const chunks = [];
    for (let i = 0; i < episodes.length; i += chunkSize) {
        chunks.push(episodes.slice(i, i + chunkSize));
    }
    return chunks;
}

// Worker message handler
self.onmessage = async (e) => {
    const { type, data } = e.data;
    
    switch (type) {
        case 'transform':
            const { xmlText, xsltText, useChunking = true } = data;
            const result = transformWithXslt(xmlText, xsltText);
            
            if (result.success && useChunking && result.episodes.length > 100) {
                // Send total count first
                self.postMessage({
                    type: 'metadata',
                    data: {
                        total: result.episodes.length,
                        timestamp: result.timestamp
                    }
                });
                
                // Send episodes in chunks
                const chunks = chunkEpisodes(result.episodes, 50);
                for (let i = 0; i < chunks.length; i++) {
                    self.postMessage({
                        type: 'chunk',
                        data: {
                            chunk: chunks[i],
                            chunkIndex: i,
                            totalChunks: chunks.length,
                            isLastChunk: i === chunks.length - 1
                        }
                    });
                    
                    // Small delay between chunks to prevent main thread blocking
                    if (i < chunks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                }
            } else if (result.success) {
                self.postMessage({
                    type: 'complete',
                    data: {
                        episodes: result.episodes,
                        total: result.episodes.length,
                        timestamp: result.timestamp
                    }
                });
            } else {
                self.postMessage({
                    type: 'error',
                    data: {
                        error: result.error,
                        timestamp: result.timestamp
                    }
                });
            }
            break;
            
        case 'ping':
            self.postMessage({ type: 'pong', data: { timestamp: Date.now() } });
            break;
            
        case 'terminate':
            self.close();
            break;
            
        default:
            self.postMessage({
                type: 'error',
                data: { error: `Unknown message type: ${type}` }
            });
    }
};

// Report worker ready
self.postMessage({ type: 'ready', data: { timestamp: Date.now() } });