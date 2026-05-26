<xsl:stylesheet version="1.0"
xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
exclude-result-prefixes="itunes">
<xsl:output method="html" encoding="UTF-8" indent="no"/>
<xsl:template match="/">
<html>
<head>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:12px;color:#111}
a{color:#0b63d6;text-decoration:none}
time{color:#666;font-size:0.9em}
ul{padding-left:18px}
.item{margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #eee}
.title{font-size:1.2em;font-weight:bold;margin-bottom:5px}
.date{color:#666;font-size:0.9em;margin-bottom:8px}
.description{color:#333;margin-top:8px}
</style>
</head>
<body>
<h1><xsl:value-of select="/rss/channel/title"/></h1>
<p><xsl:value-of select="/rss/channel/description"/></p>
<ul>
<xsl:for-each select="/rss/channel/item[position() &lt;= 50]">
<li class="item">
<div class="title">
<a href="{link}"><xsl:value-of select="title"/></a>
</div>
<div class="date">
<time><xsl:value-of select="pubDate"/></time>
</div>
<div class="description">
<xsl:value-of select="description"/>
</div>
</li>
</xsl:for-each>
</ul>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
