import { renderContent } from "@/lib/content/render";

export function ContentBlocks({ content }: { content: string }) {
  const blocks = renderContent(content);
  return (
    <div className="prose-block">
      {blocks.map((block) => {
        if (block.type === "h2") {
          return (
            <h2 key={block.key} className="display">
              {block.text}
            </h2>
          );
        }
        if (block.type === "h3") {
          return <h3 key={block.key}>{block.text}</h3>;
        }
        if (block.type === "ul") {
          return (
            <ul key={block.key}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={block.key}>{block.text}</p>;
      })}
    </div>
  );
}
