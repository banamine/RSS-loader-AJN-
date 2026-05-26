(function(){
const rssUrl = 'https://rss.alexjones.media/AJNHourlyVideo.xml';
const proxyUrl = 'https://api.allorigins.win/raw?url=';  // Free CORS proxy
const xslUrl = 'https://raw.githubusercontent.com/banamine/RSS-loader-AJN-/main/feed-style.xsl';
const iframe = document.getElementById('rssFrame');

iframe.addEventListener('load', function(){
try {
const doc = iframe.contentDocument;
if (doc && doc.documentElement && doc.documentElement.nodeName.toLowerCase() === 'html') {
return;
}
} catch(e){
// Fallback to CORS proxy
}

// Use proxy to bypass CORS
Promise.all([fetch(proxyUrl + encodeURIComponent(rssUrl)), fetch(xslUrl)])
.then(results => Promise.all(results.map(r => r.text())))
.then(([rssText, xslText]) => {
const parser = new DOMParser();
const rssDoc = parser.parseFromString(rssText, 'application/xml');
const xslDoc = parser.parseFromString(xslText, 'application/xml');
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
const pre = document.createElement('pre');
pre.textContent = rssText;
iframe.replaceWith(pre);
}
}).catch(err=>{
console.error('Fallback transform failed:', err);
const errorDiv = document.createElement('div');
errorDiv.className = 'error';
errorDiv.innerHTML = '<h3>Failed to load RSS feed</h3><p>The RSS server blocks cross-origin requests. Try using a CORS proxy or browser extension.</p>';
iframe.replaceWith(errorDiv);
});
});
})();
