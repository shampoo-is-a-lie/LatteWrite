<script>
  import { onMount, onDestroy } from 'svelte'
  import { Editor } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import Placeholder from '@tiptap/extension-placeholder'
  import Underline from '@tiptap/extension-underline'
  import TextAlign from '@tiptap/extension-text-align'
  import TextStyle from '@tiptap/extension-text-style'
  import Color from '@tiptap/extension-color'
  import FontFamily from '@tiptap/extension-font-family'

  export let content = null
  export let onReady = () => {}
  export let onChange = () => {}
  export let onSelect = () => {}

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
        FontFamily,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Start writing…' })
      ],
      content: content || '',
      autofocus: 'end',
      onUpdate: () => onChange(),
      onSelectionUpdate: () => onSelect()
    })
    onReady(editor)
  })

  onDestroy(() => editor && editor.destroy())
</script>

<div class="editor-page" bind:this={element}></div>
