import { Mark, mergeAttributes } from '@tiptap/core'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import { Plugin, NodeSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// A text special-effect (glow/neon/…) applied as a class on a span. It's a mark
// so it combines with colour/bold/etc.; the actual look lives in `.fx-*` CSS.
export const TextFx = Mark.create({
  name: 'textFx',
  addAttributes() {
    return {
      fx: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-fx'),
        renderHTML: (attrs) => (attrs.fx ? { 'data-fx': attrs.fx, class: 'fx-' + attrs.fx } : {})
      }
    }
  },
  parseHTML() { return [{ tag: 'span[data-fx]' }] },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0] },
  addCommands() {
    return {
      setFx: (fx) => ({ commands }) => commands.setMark('textFx', { fx }),
      unsetFx: () => ({ commands }) => commands.unsetMark('textFx')
    }
  }
})

// Table with a per-table borderless flag (data-borderless), toggled from the bar.
export const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      borderless: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-borderless') === 'true',
        renderHTML: (attrs) => (attrs.borderless ? { 'data-borderless': 'true' } : {})
      }
    }
  }
})

// Image with a stored pixel width and a drag-to-resize handle (node view).
export const ResizableImage = Image.extend({
  // Every image in a document is an embedded data URL; without this the paste
  // parser skips them (`img[src]:not([src^="data:"])`) and only text comes through.
  addOptions() {
    return { ...this.parent?.(), allowBase64: true }
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width'),
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {})
      }
    }
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span')
      dom.className = 'img-wrap'
      const img = document.createElement('img')
      img.src = node.attrs.src
      if (node.attrs.alt) img.alt = node.attrs.alt
      if (node.attrs.width) img.setAttribute('width', node.attrs.width)
      const handle = document.createElement('span')
      handle.className = 'img-resize'
      dom.append(img, handle)

      let startX = 0, startW = 0
      const move = (e) => { img.setAttribute('width', Math.max(40, Math.round(startW + (e.clientX - startX)))) }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        if (typeof getPos === 'function') {
          editor.view.dispatch(editor.view.state.tr.setNodeMarkup(getPos(), undefined, {
            ...node.attrs, width: Number(img.getAttribute('width'))
          }))
        }
      }
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation()
        startX = e.clientX; startW = img.offsetWidth
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
      })

      // Clicking the picture selects the node, so Ctrl+C / right-click act on it.
      const select = () => {
        const pos = typeof getPos === 'function' ? getPos() : null
        if (typeof pos === 'number') editor.commands.setNodeSelection(pos)
      }
      img.addEventListener('mousedown', select)
      img.addEventListener('contextmenu', select)

      return { dom }
    }
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        props: {
          // Browsers don't paint the text highlight over an image, so Select All
          // (and any range that covers one) marks it with a decoration instead.
          decorations: (state) => {
            const { from, to } = state.selection
            if (from === to) return null
            const decos = []
            state.doc.nodesBetween(from, to, (node, pos) => {
              if (node.type.name === 'image' && pos >= from && pos + node.nodeSize <= to) {
                decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'img-selected' }))
              }
            })
            return decos.length ? DecorationSet.create(state.doc, decos) : null
          },
          handleDOMEvents: {
            copy: (view, event) => copySelectedImage(view, event, false),
            cut: (view, event) => copySelectedImage(view, event, true)
          }
        }
      })
    ]
  }
})

function copySelectedImage(view, event, cut) {
  const sel = view.state.selection
  if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'image') return false
  event.preventDefault()
  copyImageToClipboard(sel.node.attrs)
  if (cut) view.dispatch(view.state.tr.deleteSelection().scrollIntoView())
  return true
}

const imageHtml = ({ src, width, alt }) =>
  `<img src="${src}"${width ? ` width="${width}"` : ''}${alt ? ` alt="${alt}"` : ''}>`

// Put an image on the system clipboard as a real bitmap (plus HTML, so pasting
// back into a document keeps its size) — otherwise only rich-text targets can
// take it and native apps get nothing.
export async function copyImageToClipboard(attrs) {
  const { src } = attrs
  if (!src) return false
  const html = imageHtml(attrs)
  if (window.api?.edit?.copyImage) {
    await window.api.edit.copyImage({ src, html })
    return true
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'image/png': toPngBlob(src),
      'text/html': new Blob([html], { type: 'text/html' })
    })])
    return true
  } catch {
    // Browsers that refuse image blobs still take the HTML flavour.
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })])
    return true
  }
}

function toPngBlob(src) {
  if (src.startsWith('data:image/png')) return fetch(src).then((r) => r.blob())
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png')
    }
    img.onerror = () => reject(new Error('load failed'))
    img.src = src
  })
}

export { TableRow, TableHeader, TableCell }

// Paste an image from the clipboard (e.g. a screenshot) as an embedded data URL.
export function handleImagePaste(view, event) {
  const items = event.clipboardData && event.clipboardData.items
  if (!items) return false
  // A copy from another LatteWrite doc carries both a bitmap and HTML; let the
  // HTML through so the image keeps its own encoding, width and any siblings.
  const html = event.clipboardData.getData('text/html')
  if (html && /<img[\s>]/i.test(html)) return false
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      const file = it.getAsFile()
      if (!file) continue
      const reader = new FileReader()
      reader.onload = () => {
        const node = view.state.schema.nodes.image.create({ src: reader.result })
        view.dispatch(view.state.tr.replaceSelectionWith(node))
      }
      reader.readAsDataURL(file)
      return true
    }
  }
  return false
}
