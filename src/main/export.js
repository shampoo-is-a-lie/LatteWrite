import fs from 'fs'
import TurndownService from 'turndown'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType
} from 'docx'
// A Google Fonts stylesheet <link> for the Style's families — they're free
// Google fonts, so any browser fetches and renders them.
function googleFontsLink(families) {
  const fams = [...new Set(families.filter(Boolean))]
    .map(f => `family=${encodeURIComponent(f)}:wght@400;600;700`)
  if (!fams.length) return ''
  return `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap">`
}

// ── HTML ────────────────────────────────────────────────────────────────────
// Self-contained white-background document that pulls the Style's fonts from
// Google Fonts.
export function exportHTML(outPath, { html, meta }) {
  const title = meta?.title || 'Untitled'
  const body = meta?.bodyFont || 'Georgia, serif'
  const heading = meta?.headingFont || body
  const fontsLink = googleFontsLink([meta?.headingFamily, meta?.bodyFamily])
  const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
${fontsLink}
<style>
  /* Lightness for the doc's theme-adaptive text/highlight colours (light paper). */
  :root { color-scheme: light; --fg-l: 42%; --hl-l: 79%; --hl-ink: #1a1a1a; }
  mark { color: var(--hl-ink); border-radius: 3px; padding: 0 2px; }
  body { background:#fff; color:#1a1a1a; margin:0; padding:6rem 1.5rem; font-family:${body}; line-height:1.7; }
  .page { max-width:46rem; margin:0 auto; }
  h1,h2,h3 { font-family:${heading}; line-height:1.25; }
  blockquote { border-left:3px solid #ccc; margin:1.5rem 0; padding-left:1.25rem; color:#555; }
  pre { background:#f4f4f4; padding:1rem; border-radius:8px; overflow:auto; }
  img { max-width:100%; }
</style></head>
<body><div class="page">${html}</div></body></html>`
  fs.writeFileSync(outPath, doc, 'utf8')
  return outPath
}

// ── Markdown ──────────────────────────────────────────────────────────────────
export function exportMarkdown(outPath, { html }) {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  fs.writeFileSync(outPath, td.turndown(html || ''), 'utf8')
  return outPath
}

// ── DOCX ──────────────────────────────────────────────────────────────────────
// Best-effort conversion from the Tiptap document JSON (compatibility with Word
// is explicitly not a goal — it just has to be a valid .docx).
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4]
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }

function runs(node) {
  if (!node.content) return [new TextRun('')]
  return node.content.filter(n => n.type === 'text').map(n => {
    const marks = new Set((n.marks || []).map(m => m.type))
    return new TextRun({
      text: n.text || '',
      bold: marks.has('bold'),
      italics: marks.has('italic'),
      underline: marks.has('underline') ? {} : undefined
    })
  })
}

function paragraphsFrom(node, listPrefix) {
  switch (node.type) {
    case 'heading':
      return [new Paragraph({ heading: HEADINGS[(node.attrs?.level || 1) - 1] || HeadingLevel.HEADING_1, children: runs(node) })]
    case 'paragraph':
      return [new Paragraph({ alignment: ALIGN[node.attrs?.textAlign] || AlignmentType.LEFT, children: runs(node) })]
    case 'blockquote':
      return (node.content || []).flatMap(child =>
        [new Paragraph({ indent: { left: 480 }, children: runs(child) })])
    case 'bulletList':
      return (node.content || []).flatMap(li =>
        (li.content || []).map(p => new Paragraph({ bullet: { level: 0 }, children: runs(p) })))
    case 'orderedList':
      return (node.content || []).flatMap((li, i) =>
        (li.content || []).map(p => new Paragraph({ children: [new TextRun(`${i + 1}. `), ...runs(p)] })))
    case 'codeBlock':
      return [new Paragraph({ children: (node.content || []).map(n => new TextRun({ text: n.text || '', font: 'Consolas' })) })]
    default:
      return [new Paragraph({ children: runs(node) })]
  }
}

export async function exportDocx(outPath, { doc }) {
  const children = (doc?.content || []).flatMap(n => paragraphsFrom(n))
  const document = new Document({ sections: [{ children: children.length ? children : [new Paragraph('')] }] })
  fs.writeFileSync(outPath, await Packer.toBuffer(document))
  return outPath
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
