// ============ XML TO JSON CONVERSION UTILITY ============
// Safe conversion without eval or innerHTML

export function xmlToJson(xml) {
    // Create the return object
    let obj = {};

    if (xml.nodeType === 1) { // element
        // do attributes
        if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
            for (let j = 0; j < xml.attributes.length; j++) {
                const attribute = xml.attributes.item(j);
                obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
            }
        }
    } else if (xml.nodeType === 3) { // text
        obj = xml.nodeValue.trim();
    }

    // do children
    if (xml.hasChildNodes()) {
        for (let i = 0; i < xml.childNodes.length; i++) {
            const item = xml.childNodes.item(i);
            const nodeName = item.nodeName;
            
            if (typeof (obj[nodeName]) === "undefined") {
                obj[nodeName] = xmlToJson(item);
            } else {
                if (typeof (obj[nodeName].push) === "undefined") {
                    const old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                }
                obj[nodeName].push(xmlToJson(item));
            }
        }
    }
    
    return obj;
}

export function extractRssItems(rssJson) {
    try {
        if (rssJson && rssJson.rss && rssJson.rss.channel && rssJson.rss.channel.item) {
            const items = rssJson.rss.channel.item;
            return Array.isArray(items) ? items : [items];
        }
        return [];
    } catch (error) {
        console.error('Failed to extract RSS items:', error);
        return [];
    }
}

export function extractChannelInfo(rssJson) {
    try {
        if (rssJson && rssJson.rss && rssJson.rss.channel) {
            const channel = rssJson.rss.channel;
            return {
                title: channel.title || '',
                description: channel.description || '',
                link: channel.link || '',
                language: channel.language || '',
                lastBuildDate: channel.lastBuildDate || '',
                copyright: channel.copyright || ''
            };
        }
        return {};
    } catch (error) {
        console.error('Failed to extract channel info:', error);
        return {};
    }
}

export function sanitizeEpisodeData(episode) {
    return {
        title: (episode.title || '').replace(/[<>]/g, ''),
        link: episode.link || '',
        description: (episode.description || '').replace(/<[^>]*>/g, '').substring(0, 500),
        pubDate: episode.pubDate || '',
        guid: episode.guid || '',
        enclosure: episode.enclosure ? {
            url: episode.enclosure['@attributes']?.url || episode.enclosure.url || '',
            type: episode.enclosure['@attributes']?.type || episode.enclosure.type || '',
            length: episode.enclosure['@attributes']?.length || episode.enclosure.length || ''
        } : null
    };
}

export function validateRssStructure(rssJson) {
    if (!rssJson || !rssJson.rss) {
        return { valid: false, error: 'Missing root RSS element' };
    }
    
    if (!rssJson.rss.channel) {
        return { valid: false, error: 'Missing channel element' };
    }
    
    if (!rssJson.rss.channel.item || !rssJson.rss.channel.item.length) {
        return { valid: false, error: 'No items found in feed' };
    }
    
    return { valid: true, error: null };
}