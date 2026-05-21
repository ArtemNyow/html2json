# html2json

Simple implementation of `html2json` for converting HTML into a JSON tree.

## What is included

- `html2json.js` — parser implementation
- `index.html` — UI for input and output
- `html_samples/` — test HTML cases
- `ai_help/chatgpt_chat.txt` — AI usage note

## Features

- manual parser without DOM
- nested tags, multiple roots, malformed HTML handling
- void and self-closing tags
- raw text tags: `script`, `style`, `textarea`
- comments and doctype ignored
- boolean attributes and entity decoding
- parse diagnostics via `root.errors`

## Test

Open `index.html` in the browser, paste HTML, and click Convert.

Or run locally:

```bash
node -e "const { html2json } = require('./html2json'); const fs = require('fs'); const html = fs.readFileSync('html_samples/basic.html', 'utf8'); console.log(JSON.stringify(html2json(html), null, 2));"
```
