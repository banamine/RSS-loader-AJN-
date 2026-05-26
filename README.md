# RSS-loader-AJN-
AJN Hourly Video RSS Viewer  This repository hosts an XSL stylesheet and HTML wrapper to view the AJN Hourly Video RSS feed with styling.
# AJN Hourly Video RSS Viewer

This repository hosts an XSL stylesheet and HTML wrapper to view the AJN Hourly Video RSS feed with styling.

## Files

- `feed-style.xsl` - XSL transformation for the RSS feed
- `index.html` - Main viewer page with iframe + JavaScript fallback
- `fetch-and-transform.js` - Client-side fetch and XSLT transformation

## Setup Instructions

### 1. Update the XSL URL

Edit `fetch-and-transform.js` and change the `xslUrl` variable from:

```javascript
const xslUrl = 'https://raw.githubusercontent.com/YOUR_GH_USERNAME/YOUR_REPO/main/feed-style.xsl';
