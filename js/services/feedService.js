// js/services/feedService.js
// By defining it this way without 'const' or 'let' inside a module, 
// it becomes a global variable that main.js can see.
window.feedService = {
    fetchFeed: async function(url) {
        const proxy = "https://api.allorigins.win/get?url=";
        const response = await fetch(proxy + encodeURIComponent(url));
        const data = await response.json();
        const parser = new DOMParser();
        return parser.parseFromString(data.contents, "application/xml");
    }
};