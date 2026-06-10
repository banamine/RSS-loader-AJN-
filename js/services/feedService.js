async function fetchRSSFeed(retryCount = 0) {
  const WORKER_PROXY = 'https://muddy-unit-f498.banamine.workers.dev/?url=';
  const FALLBACK_PROXY = 'https://api.allorigins.win/raw?url=';
  const RSS_FEED_URL = 'https://rss.alexjones.media/AJNHourlyVideo.xml';
  
  const proxyUrl = WORKER_PROXY + encodeURIComponent(RSS_FEED_URL);
  feedStatusSpan.innerHTML = '📡 Fetching RSS feed via Worker...';
  updateProxyStatus('Connecting to worker proxy...');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) throw new Error('Invalid XML');
    return xmlDoc;
  } catch (err) {
    console.warn(`Worker proxy failed (attempt ${retryCount+1}):`, err.message);
    
    // Try fallback public proxy if worker fails
    if (retryCount === 0) {
      updateProxyStatus('Worker failed, trying fallback proxy...');
      feedStatusSpan.innerHTML = '🔄 Worker unavailable, using fallback...';
      try {
        const fallbackUrl = FALLBACK_PROXY + encodeURIComponent(RSS_FEED_URL);
        const response = await fetch(fallbackUrl);
        if (!response.ok) throw new Error(`Fallback HTTP ${response.status}`);
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) throw new Error('Invalid XML from fallback');
        updateProxyStatus('Fallback proxy succeeded');
        feedStatusSpan.innerHTML = '✅ RSS loaded (fallback)';
        return xmlDoc;
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
        if (retryCount < 2) {
          updateProxyStatus(`Retrying (${retryCount+2}/3)...`);
          await new Promise(r => setTimeout(r, 1000));
          return fetchRSSFeed(retryCount + 1);
        }
        throw new Error(`Both proxies failed: ${err.message}`);
      }
    } else {
      throw err;
    }
  }
}
