function convertHtml2JsonAndSet() {
  const htmlTextAreaValue = document.getElementById("html").value;
  const jsonObj = html2json(htmlTextAreaValue);
  const jsonArea = document.getElementById("json");
  jsonArea.textContent = JSON.stringify(jsonObj, null, 2);
}

function html2json(htmlText) {
  if (typeof htmlText !== "string") {
    return { type: "root", children: [], text: "" };
  }

  const VOID_TAGS =
    /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
  const RAW_TAGS = /^(script|style|textarea)$/i;

  const errors = [];
  const root = { type: "root", children: [], text: "", errors };
  const stack = [root];
  const length = htmlText.length;

  function addError(message, position) {
    errors.push({ message, position });
  }

  let i = 0;
  while (i < length) {
    const parent = stack[stack.length - 1];

    if (htmlText[i] === "<") {
      if (htmlText.startsWith("<!--", i)) {
        const commentEnd = htmlText.indexOf("-->", i + 4);
        i = commentEnd >= 0 ? commentEnd + 3 : length;
        continue;
      }

      if (/^<!DOCTYPE/i.test(htmlText.slice(i, i + 10))) {
        const doctypeEnd = htmlText.indexOf(">", i + 2);
        i = doctypeEnd >= 0 ? doctypeEnd + 1 : length;
        continue;
      }

      if (htmlText[i + 1] === "/") {
        const closeStart = i + 2;
        const closeMatch = htmlText
          .slice(closeStart)
          .match(/^\s*([a-zA-Z][\w:-]*)/);
        const closeTag = closeMatch ? closeMatch[1] : "";
        const tagEnd = htmlText.indexOf(">", closeStart);
        i = tagEnd >= 0 ? tagEnd + 1 : length;

        if (closeTag) {
          const lowerClose = closeTag.toLowerCase();
          let matchedIndex = -1;
          for (let j = stack.length - 1; j > 0; j--) {
            if (stack[j].tag && stack[j].tag.toLowerCase() === lowerClose) {
              matchedIndex = j;
              break;
            }
          }

          if (matchedIndex === -1) {
            addError(
              `Unmatched closing tag </${closeTag}> at position ${i}`,
              i,
            );
          } else {
            if (matchedIndex !== stack.length - 1) {
              addError(
                `Mismatched closing tag </${closeTag}> at position ${i}; expected </${stack[stack.length - 1].tag}>`,
                i,
              );
            }
            stack.length = matchedIndex;
          }
        }
        continue;
      }

      const openTagMatch = htmlText.slice(i + 1).match(/^([a-zA-Z][\w:-]*)/);
      if (!openTagMatch) {
        const nextLt = htmlText.indexOf("<", i + 1);
        const nextGt = htmlText.indexOf(">", i + 1);
        if (nextGt !== -1 && (nextLt === -1 || nextGt < nextLt)) {
          const inside = htmlText.slice(i + 1, nextGt);
          const insideTrim = inside.trim();
          const nextNonSpace = inside.match(/^\s*([^\s>])/);
          const isMalformedGuess =
            insideTrim === "" ||
            insideTrim.startsWith("<") ||
            (nextNonSpace
              ? (/^[A-Za-z]/.test(nextNonSpace[1]) &&
                  /^[\s]*[A-Za-z][\w:-]*\s*$/.test(inside)) ||
                (/^[0-9]/.test(nextNonSpace[1]) &&
                  /^[\s]*[0-9]+\s*$/.test(inside))
              : false);

          if (isMalformedGuess) {
            addError(`Malformed tag at position ${i}`, i);
            appendText(htmlText.slice(i, nextGt + 1), parent);
            i = nextGt + 1;
            continue;
          }
        }

        appendText("<", parent);
        i += 1;
        continue;
      }

      const tag = openTagMatch[1];
      let j = i + 1 + tag.length;
      let inQuote = null;
      while (j < length) {
        const ch = htmlText[j];
        if (inQuote) {
          if (ch === inQuote) {
            inQuote = null;
          }
        } else if (ch === '"' || ch === "'") {
          inQuote = ch;
        } else if (ch === ">") {
          break;
        }
        j += 1;
      }

      if (j >= length) {
        addError(`Unclosed tag <${tag}> at end of input`, i);
        appendText(htmlText.slice(i), parent);
        break;
      }

      let attrText = htmlText.slice(i + 1 + tag.length, j);
      let k = attrText.length - 1;
      while (k >= 0 && /\s/.test(attrText[k])) {
        k -= 1;
      }

      const isSelfClosing = k >= 0 && attrText[k] === "/";
      if (isSelfClosing) {
        attrText = attrText.slice(0, k).trim();
      } else {
        attrText = attrText.trim();
      }

      const node = {
        tag,
        attrs: parseAttributes(attrText),
        children: [],
        text: "",
      };

      parent.children.push(node);
      if (!isSelfClosing && !VOID_TAGS.test(tag)) {
        stack.push(node);
      }

      i = j + 1;

      if (!isSelfClosing && RAW_TAGS.test(tag)) {
        const rawEnd = new RegExp(`</\\s*${tag}\\s*>`, "i");
        const remaining = htmlText.slice(i);
        const rawMatch = rawEnd.exec(remaining);
        const rawContent = rawMatch
          ? remaining.slice(0, rawMatch.index)
          : remaining;

        if (rawContent) {
          node.children.push(rawContent);
          node.text += rawContent;
        }

        if (!rawMatch) {
          addError(`Unclosed raw element <${tag}> at end of input`, i);
        }

        i += rawMatch ? rawMatch.index + rawMatch[0].length : rawContent.length;
        stack.pop();
      }
      continue;
    }

    const nextTag = htmlText.indexOf("<", i);
    const rawText = htmlText.slice(i, nextTag >= 0 ? nextTag : length);
    appendText(rawText, parent);
    i = nextTag >= 0 ? nextTag : length;
  }

  if (stack.length > 1) {
    addError(
      `Unclosed tags at end of input: ${stack
        .slice(1)
        .map((node) => `<${node.tag}>`)
        .join(", ")}`,
      length,
    );
  }

  return root;

  function appendText(rawText, currentParent) {
    if (!rawText) {
      return;
    }

    const normalized =
      currentParent.tag && currentParent.tag.toLowerCase() === "pre"
        ? rawText
        : decodeEntities(rawText.replace(/\s+/g, " ").trim());

    if (!normalized) {
      return;
    }

    currentParent.children.push(normalized);
    currentParent.text += (currentParent.text ? " " : "") + normalized;
  }

  function parseAttributes(attrStr) {
    const attributes = {};
    const attrRegex =
      /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match;
    while ((match = attrRegex.exec(attrStr)) !== null) {
      attributes[match[1]] = decodeEntities(
        match[2] ?? match[3] ?? match[4] ?? "",
      );
    }
    return attributes;
  }

  function decodeEntities(str) {
    if (!str) {
      return "";
    }

    return str
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, "\u00A0")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16)),
      );
  }
}

function showExample1() {
  const htmlExample = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport">
    <title>Sample HTML</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>Welcome to My Website</h1>
    </header>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
    </nav>
    <main>
        <section id="home">
            <h2>Home Section</h2>
            <p>This is the home section of the webpage.</p>
        </section>
        <section id="about">
            <h2>About Section</h2>
            <p>This is the about section of the webpage.</p>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 My Website</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>`;

  document.getElementById("html").value = htmlExample;
  document.getElementById("json").textContent = JSON.stringify(
    html2json(htmlExample),
    null,
    2,
  );
}

function showExample2() {
  const htmlExample = `<div>
<p>Hello world!</p>
  <button>Click me!</button>
  <textarea>Some very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long string.</textarea>
</div>`;

  document.getElementById("html").value = htmlExample;
  document.getElementById("json").textContent = JSON.stringify(
    html2json(htmlExample),
    null,
    2,
  );
}
