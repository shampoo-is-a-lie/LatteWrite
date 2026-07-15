import { defineConfig } from 'vite'

// Standalone web build for the .latte viewer/editor. Reuses the renderer's Tiptap
// extension code (../src/renderer/src/*) so the schema stays identical to the app
// and files round-trip losslessly. Output goes to /docs for GitHub Pages, and
// base:'./' keeps asset URLs relative so it works under username.github.io/repo/.
export default defineConfig({
  root: 'web',
  base: './',
  // The web entry imports shared modules that live outside web/ (in src/renderer).
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../docs',
    emptyOutDir: true
  }
})
