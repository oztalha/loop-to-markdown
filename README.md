# Loop to Markdown

Tampermonkey userscripts (or bookmarklets) that convert Microsoft Loop pages to Markdown or MediaWiki with one click.

## Features

- Tables, code blocks, headings, lists (ordered, unordered, checkboxes)
- @mentions, hyperlinks, inline code
- Bold text detection
- Code language auto-detection (Python, JavaScript, SQL, YAML, JSON, Mermaid, etc.)
- Loop page title detection and export as the document title
- Heading level offset in Markdown exports to preserve a single top-level `#` heading
- Quip link capture
- Clipboard fallbacks for environments where `GM_setClipboard` is unavailable

## Available Scripts

- `loop-to-markdown.user.js`: exports Loop pages as Markdown
- `loop-to-mediawiki.user.js`: exports Loop pages as MediaWiki wikitext

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Install the exporter you want:
   - [Markdown userscript](https://raw.githubusercontent.com/oztalha/loop-to-markdown/main/loop-to-markdown.user.js)
   - [MediaWiki userscript](https://raw.githubusercontent.com/oztalha/loop-to-markdown/main/loop-to-mediawiki.user.js)

## Bookmarklet (no extension required)

Prefer a bookmarks-bar button over a browser extension? The same exporters are
also available as bookmarklets in `dist/`.

1. Open `dist/install.html` in your browser
2. Drag the button you want onto your bookmarks bar:
   - `📋 Copy Loop as Markdown`
   - `📋 Copy Loop as MediaWiki`
3. Open a Microsoft Loop page and click the bookmark to copy the page

The bookmarklets are generated from the userscripts by `build-bookmarklets.py`,
so the two stay in sync — edit a `*.user.js`, then run
`python3 build-bookmarklets.py` to regenerate `dist/`.

## Usage

1. Open any Microsoft Loop page
2. Click the exporter button in the bottom-left corner (userscript) or the
   bookmarks-bar bookmarklet:
   - `📋 Copy as Markdown`
   - `📋 Copy as MediaWiki`
3. Paste the copied output into your target editor or wiki

## Notes

- Markdown exports add the detected Loop page title as `# Title` when available.
- Loop headings are shifted down by one level in Markdown so the exported title remains the only H1.
- Both scripts try `GM_setClipboard`, then the browser Clipboard API, then a `document.execCommand('copy')` fallback.

## Contributors

- [Talha Oz](https://github.com/oztalha) - Original author
- Yuta TJ (yutatj@) - Table cell fallback extraction
- Shrinivas Acharya - Bold detection, code language detection, ordered lists
- Andrea Scian - Clipboard fallbacks, Loop title detection, heading offset, MediaWiki exporter

## Contributing

Found a bug or have an improvement? PRs are welcome! This script was built with contributions from multiple people - yours could be next.

## License

GPL-3.0
