export function renderContent(content: string) {
  const blocks = content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const result: Array<
    | { type: "h2"; text: string; key: number }
    | { type: "h3"; text: string; key: number }
    | { type: "ul"; items: string[]; key: number }
    | { type: "p"; text: string; key: number }
  > = [];

  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];

    if (block.startsWith("## ")) {
      result.push({ type: "h2", text: block.replace(/^##\s+/, ""), key: index });
      index += 1;
      continue;
    }
    if (block.startsWith("### ")) {
      result.push({ type: "h3", text: block.replace(/^###\s+/, ""), key: index });
      index += 1;
      continue;
    }
    if (block.startsWith("- ") || block.startsWith("* ")) {
      const items = block
        .split("\n")
        .map((l) => l.replace(/^[-*]\s+/, "").trim())
        .filter(Boolean);
      result.push({ type: "ul", items, key: index });
      index += 1;
      continue;
    }

    // After an intro ending with ":", group following short labels into a list
    if (/[:：]$/.test(block)) {
      result.push({ type: "p", text: block, key: index });
      index += 1;
      const start = index;
      const items: string[] = [];
      while (index < blocks.length && isShortLabel(blocks[index])) {
        items.push(blocks[index]);
        index += 1;
      }
      if (items.length >= 2) {
        result.push({ type: "ul", items, key: start });
      } else {
        items.forEach((item, offset) => {
          result.push({ type: "p", text: item, key: start + offset });
        });
      }
      continue;
    }

    result.push({ type: "p", text: block, key: index });
    index += 1;
  }

  return result;
}

function isShortLabel(block: string) {
  if (!block || block.startsWith("##") || block.startsWith("- ") || block.startsWith("* ")) {
    return false;
  }
  if (/[:：]$/.test(block)) return false;
  if (block.includes(". ") || /[.!?]$/.test(block)) return false;
  const words = block.split(/\s+/).length;
  return words <= 8 && block.length <= 70;
}
