'use client';

import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  function flushTable() {
    if (!inTable || tableRows.length === 0) return;
    inTable = false;
    let html = '<table>';
    tableRows.forEach((row, i) => {
      // Skip separator rows (|---|---|)
      if (/^\|[\s\-:|]+\|$/.test(row)) return;
      const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
      const tag = i === 0 ? 'th' : 'td';
      html += '<tr>' + cells.map(c => `<${tag}>${renderInline(c)}</${tag}>`).join('') + '</tr>';
    });
    html += '</table>';
    output.push(html);
    tableRows = [];
  }

  function renderInline(text: string): string {
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
      if (/^(https?:|mailto:|#|\/)/i.test(href)) {
        return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
      }
      return text;
    });
    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        flushTable();
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        codeLines = [];
      } else {
        const code = escapeHtml(codeLines.join('\n'));
        const header = codeLang ? `<div class="code-header">${escapeHtml(codeLang)}</div>` : '';
        output.push(`<div class="code-block">${header}<pre><code>${code}</code></pre></div>`);
        inCodeBlock = false;
        codeLang = '';
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // Table detection (lines starting and ending with |)
    if (/^\|.+\|$/.test(line.trim())) {
      if (!inTable) inTable = true;
      tableRows.push(line.trim());
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Empty line
    if (!line.trim()) { continue; }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) { output.push(`<h${hMatch[1].length}>${renderInline(hMatch[2])}</h${hMatch[1].length}>`); continue; }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { output.push('<hr/>'); continue; }

    // Blockquote
    if (line.startsWith('> ')) { output.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`); continue; }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      // Collect consecutive list items
      const items = [ulMatch[2]];
      while (i + 1 < lines.length && /^\s*[-*+]\s+/.test(lines[i + 1])) {
        i++;
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
      }
      output.push('<ul>' + items.map(it => `<li>${renderInline(it)}</li>`).join('') + '</ul>');
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+[.)]\s+(.+)$/);
    if (olMatch) {
      const items = [olMatch[2]];
      while (i + 1 < lines.length && /^\s*\d+[.)]\s+/.test(lines[i + 1])) {
        i++;
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
      }
      output.push('<ol>' + items.map(it => `<li>${renderInline(it)}</li>`).join('') + '</ol>');
      continue;
    }

    // Paragraph
    output.push(`<p>${renderInline(line)}</p>`);
  }

  flushTable();
  if (inCodeBlock) {
    output.push(`<div class="code-block"><pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre></div>`);
  }

  return output.join('\n');
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
