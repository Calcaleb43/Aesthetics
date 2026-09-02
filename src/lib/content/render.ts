export function renderContent(content: string) {
  const blocks = content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith("## ")) {
      return { type: "h2" as const, text: block.replace(/^##\s+/, ""), key: index };
    }
    if (block.startsWith("### ")) {
      return { type: "h3" as const, text: block.replace(/^###\s+/, ""), key: index };
    }
    if (block.startsWith("- ")) {
      const items = block
        .split("\n")
        .map((l) => l.replace(/^[-*]\s+/, "").trim())
        .filter(Boolean);
      return { type: "ul" as const, items, key: index };
    }
    return { type: "p" as const, text: block, key: index };
  });
}
