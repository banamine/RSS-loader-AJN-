(function(){
const rssUrl = 'https://rss.alexjones.media/AJNHourlyVideo.xml';
const proxyUrl = 'https://api.allorigins.win/raw?url='; // CORS proxy
const xslUrl = 'https://raw.githubusercontent.com/banamine/RSS-loader-AJN-/main/feed-style.xsl';
const iframe = document.getElementById('rssFrame');

iframe.addEventListener('load', function(){
try {
const doc = iframe.contentDocument;
if (doc && doc.documentElement && doc.documentElement.nodeName.toLowerCase() === 'html') {
return;
}
} catch(e){
// Fallback triggered
}

// Fetch RSS through CORS proxy
fetch(proxyUrl + encodeURIComponent(rssUrl))
.then(response => {
if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
return response.text();
})
.then(rssText => {
// Check if RSS is actually RSS (not HTML error page)
if (rssText.includes('<html') || rssText.includes('<!DOCTYPE')) {
throw new Error('RSS server returned HTML error page instead of XML');
}
if (!rssText.includes('<rss') && !rssText.includes('<feed')) {
throw new Error('Response is not valid RSS/XML format');
}

// Fetch XSL
return fetch(xslUrl)
.then(response => {
if (!response.ok) throw new Error(`XSL HTTP ${response.status}`);
return response.text();
})
.then(xslText => {
// Parse both documents
const parser = new DOMParser();
const rssDoc = parser.parseFromString(rssText, 'text/xml');
const xslDoc = parser.parseFromString(xslText, 'text/xml');

// Check for XML parsing errors
const rssParseError = rssDoc.getElementsByTagName('parsererror');
if (rssParseError.length) {
console.error('RSS Parse Error:', rssParseError[0].textContent);
throw new Error('RSS XML is malformed');
}

const xslParseError = xslDoc.getElementsByTagName('parsererror');
if (xslParseError.length) {
console.error('XSL Parse Error:', xslParseError[0].textContent);
throw new Error('XSL file is malformed');
}

// Apply transformation
if (window.XSLTProcessor) {
const proc = new XSLTProcessor();
proc.importStylesheet(xslDoc);
const resultDoc = proc.transformToFragment(rssDoc, document);
const container = document.createElement('div');
container.className = 'fallback-container';
container.appendChild(resultDoc);
iframe.replaceWith(container);
} else {
// Fallback: display as JSON-like structure
const container = document.createElement('div');
container.className = 'fallback-container';
container.innerHTML = '<h2>RSS Feed (Raw XML View)</h2><pre>' + escapeHtml(rssText) + '</pre>';
iframe.replaceWith(container);
}
});
})
.catch(err => {
console.error('Fallback transform failed:', err);
// Display user-friendly error with direct link
const errorDiv = document.createElement('div');
errorDiv.className = 'error';
errorDiv.style.cssText = 'padding:20px;margin:20px;background:#ffebee;border-radius:8px;color:#d32f2f;text-align:center';
errorDiv.innerHTML = `
<h3>Unable to Load RSS Feed</h3>
<p><strong>Error:</strong> ${err.message}</p>
<p>The RSS feed may be unavailable or temporarily blocked.</p>
<p><a href="${rssUrl}" target="_blank" style="color:#0b63d6">Click here to view the raw RSS feed</a></p>
<hr>
<p style="font-size:0.9em;color:#666">Alternative viewers:</p>
<ul style="text-align:left;display:inline-block">
<li><a href="https://rss2json.com/#rss_url=${encodeURIComponent(rssUrl)}" target="_blank">View with RSS2JSON</a></li>
<li><a href="https://feed.mikle.com/" target="_blank">Embed with Feed.mikle</a></li>
</ul>
`;
iframe.replaceWith(errorDiv);
});

// Helper function to escape HTML
function escapeHtml(text) {
const div = document.createElement('div');
div.textContent = text;
return div.innerHTML;
}
});
})();
