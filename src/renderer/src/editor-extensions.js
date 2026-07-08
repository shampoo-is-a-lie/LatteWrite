import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'

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
      return { dom }
    }
  }
})

export { TableRow, TableHeader, TableCell }

// Paste an image from the clipboard (e.g. a screenshot) as an embedded data URL.
export function handleImagePaste(view, event) {
  const items = event.clipboardData && event.clipboardData.items
  if (!items) return false
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
