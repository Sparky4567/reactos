import { createElement, Fragment, type ReactNode } from "react";

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={`i-${key++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={`c-${key++}`} className="md-inline-code">{token.slice(1, -1)}</code>);
    } else {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        nodes.push(
          <a key={`a-${key++}`} href={m[2]} target="_blank" rel="noopener noreferrer">
            {m[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length ? nodes : [text];
}

export function Markdown({ children }: { children: string }) {
  const src = children ?? "";
  const lines = src.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++;
      blocks.push(
        <pre key={`pre-${blockKey++}`} className="md-code-block">
          <code className={lang ? `language-${lang}` : undefined}>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (trimmed === "") {
      i++;
      continue;
    }

    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1]!.length;
      blocks.push(createElement(`h${level}`, { key: `h-${blockKey++}`, className: "md-heading" }, parseInline(hMatch[2]!)));
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        bqLines.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={`bq-${blockKey++}`} className="md-blockquote">
          <Markdown>{bqLines.join("\n")}</Markdown>
        </blockquote>
      );
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="md-list">
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${blockKey++}`} className="md-list">
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^(\*\*\*|---|___)\s*$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${blockKey++}`} className="md-hr" />);
      i++;
      continue;
    }

    // table (GFM)
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]!)) {
      const parseRow = (row: string) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
      const header = parseRow(line);
      const sep = parseRow(lines[i + 1]!);
      const align = sep.map((cell) => {
        const t = cell.trim();
        if (t.startsWith(":") && t.endsWith(":")) return "center";
        if (t.endsWith(":")) return "right";
        return "left";
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim() !== "" && lines[i]!.includes("|")) {
        rows.push(parseRow(lines[i]!));
        i++;
      }
      blocks.push(
        <table key={`tbl-${blockKey++}`} className="md-table">
          <thead>
            <tr>
              {header.map((h, idx) => (
                <th key={idx} style={{ textAlign: align[idx] ?? "left" }}>{parseInline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ridx) => (
              <tr key={ridx}>
                {header.map((_, cidx) => (
                  <td key={cidx} style={{ textAlign: align[cidx] ?? "left" }}>{parseInline(r[cidx] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.trim().startsWith("```") &&
      !lines[i]!.match(/^#{1,6}\s/) &&
      !/^\s*[-*+]\s+/.test(lines[i]!) &&
      !/^\s*\d+\.\s+/.test(lines[i]!) &&
      !lines[i]!.trim().startsWith(">") &&
      !/^(\*\*\*|---|___)\s*$/.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    if (paraLines.length) {
      blocks.push(
        <p key={`p-${blockKey++}`} className="md-paragraph">
          {parseInline(paraLines.join(" "))}
        </p>
      );
    }
  }

  return <Fragment>{blocks}</Fragment>;
}

export default Markdown;
