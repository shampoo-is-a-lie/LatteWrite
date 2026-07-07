// Bundled default fonts so the app is beautiful offline. Any Google font can be
// loaded on top of these at runtime (phase 2).
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/600.css'
import '@fontsource/lora/700.css'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/source-serif-4/700.css'
import '@fontsource/raleway/400.css'
import '@fontsource/raleway/600.css'
import '@fontsource/raleway/700.css'
import '@fontsource/jetbrains-mono/400.css'

import './app.css'
import App from './App.svelte'

export default new App({ target: document.getElementById('app') })
