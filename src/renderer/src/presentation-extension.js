import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Focus/reveal styling must go through ProseMirror decorations — external DOM
// edits to the blocks get reverted by ProseMirror on its next redraw. Flags live
// in the extension storage; decorations recompute on every state change (so
// focus follows the caret) and on the forced refresh when a flag toggles.
export const Presentation = Extension.create({
  name: 'presentation',

  addStorage() {
    return { focus: false, reveal: false, revealCount: 1 }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin({
        key: new PluginKey('lw-presentation'),
        props: {
          decorations(state) {
            if (!storage.focus && !storage.reveal) return null
            const current = state.selection.$head.index(0)
            const decos = []
            let i = 0
            state.doc.forEach((node, pos) => {
              if (storage.reveal && i >= storage.revealCount) {
                decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'lw-hidden' }))
              } else if (storage.focus && i !== current) {
                decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'lw-dim' }))
              }
              i++
            })
            return DecorationSet.create(state.doc, decos)
          }
        }
      })
    ]
  }
})
