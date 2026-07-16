<script>
  import { onMount, onDestroy } from 'svelte'
  import { Editor } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import Placeholder from '@tiptap/extension-placeholder'
  import Underline from '@tiptap/extension-underline'
  import TextAlign from '@tiptap/extension-text-align'
  import TextStyle from '@tiptap/extension-text-style'
  import Color from '@tiptap/extension-color'
  import Highlight from '@tiptap/extension-highlight'
  import FontFamily from '@tiptap/extension-font-family'
  import { Presentation } from '../presentation-extension.js'
  import { CustomTable, ResizableImage, TableRow, TableHeader, TableCell, TextFx, handleImagePaste } from '../editor-extensions.js'

  export let content = null
  export let onReady = () => {}
  export let onChange = () => {}
  export let onSelect = () => {}
  export let focus = false
  export let reveal = false
  export let revealCount = 1
  export let editable = true

  let element
  let editor

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        FontFamily,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Start writing…' }),
        Presentation,
        CustomTable.configure({ resizable: false }),
        TableRow, TableHeader, TableCell,
        ResizableImage,
        TextFx
      ],
      content: content || '',
      editable,
      autofocus: editable ? 'end' : false,
      editorProps: { handlePaste: (view, event) => handleImagePaste(view, event) },
      onUpdate: ({ transaction }) => { if (transaction.docChanged) onChange() },
      onSelectionUpdate: () => onSelect()
    })
    onReady(editor)
  })

  $: if (editor) editor.setEditable(editable)

  // Push presentation flags into the extension and force a decoration refresh.
  $: if (editor) {
    editor.storage.presentation.focus = focus
    editor.storage.presentation.reveal = reveal
    editor.storage.presentation.revealCount = revealCount
    editor.view.dispatch(editor.state.tr.setMeta('lw-presentation', Date.now()))
  }

  onDestroy(() => editor && editor.destroy())
</script>

<div class="editor-page" bind:this={element}></div>
