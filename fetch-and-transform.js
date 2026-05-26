(function(){
const rssUrl = 'https://rss.alexjones.media/AJNHourlyVideo.xml';
const xslUrl = 'https://raw.githubusercontent.com/YOUR_GH_USERNAME/YOUR_REPO/main/feed-style.xsl'; // UPDATE THIS
const iframe = document.getElementById('rssFrame');

// If iframe loads successfully, do nothing. Detect failure via load event checking contentDocument.
iframe.addEventListener('load', function(){
try {
const doc = iframe.contentDocument;
if (doc && doc.documentElement && doc.documentElement.nodeName.toLowerCase() === 'html') {
// transformed successfully — stop.
return;
}
} catch(e){
// cross-origin — fallback to fetch+transform
}
// Fallback: fetch RSS and XSL, then transform and replace iframe with result
Promise.all([fetch(rssUrl), fetch(xslUrl)])
.then(results => Promise.all(results.map(r => r.text())))
.then(([rssText, xslText]) => {
const parser = new DOMParser();
const rssDoc = parser.parseFromString(rssText, 'application/xml');
const xslDoc = parser.parseFromString(xslText, 'application/xml');
// Basic error check
if (rssDoc.getElementsByTagName('parsererror').length || xslDoc.getElementsByTagName('parsererror').length) {
throw new Error('XML parse error');
}
if (window.XSLTProcessor) {
const proc = new XSLTProcessor();
proc.importStylesheet(xslDoc);
const resultDoc = proc.transformToFragment(rssDoc, document);
const container = document.createElement('div');
container.className = 'fallback-container';
container.appendChild(resultDoc);
iframe.replaceWith(container);
} else {
// No XSLTProcessor (old browser): show raw XML
const pre = document.createElement('pre');
pre.textContent = rssText;
iframe.replaceWith(pre);
}
}).catch(err=>{
console.error('Fallback transform failed:', err);
const errorDiv = document.createElement('div');
errorDiv.className = 'error';
errorDiv.innerHTML = '<h3>Failed to load RSS feed</h3><p>Please check the console for details.</p>';
iframe.replaceWith(errorDiv);
});
});
})();
