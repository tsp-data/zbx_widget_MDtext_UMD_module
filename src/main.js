import { createApp, reactive } from 'vue'
import App from './App.vue'

/*
 * Standalone development entry (npm run dev).
 *
 * Provides the same reactive state entry.js provides inside Zabbix, fed from the
 * controls in index.html: the textarea plays the widget's conf (JSON) field, the
 * theme switch approximates the Zabbix themes, and the button simulates one
 * refresh cycle (the wrapper's update() call).
 */
const initialConf = {
  text: '# Dashboard title\nSecond line of the heading\n\nA paragraph with **bold**, `code` and a [link](https://www.zabbix.com/).',
  // url: '/sample.md',
  align: 'left',
  valign: 'top',
  scale: 1,
}

const widgetState = reactive({
  conf: initialConf,
  context: { widgetid: '12345', rf_rate: -1 },
  zbx: { capabilities: {} },
  cycle: 0,
})

const app = createApp(App)
app.provide('widgetState', widgetState)
app.mount('#app')

const confEl = document.getElementById('conf')
confEl.value = JSON.stringify(initialConf, null, 2)
confEl.addEventListener('input', () => {
  try {
    widgetState.conf = JSON.parse(confEl.value)
    confEl.classList.remove('invalid')
  } catch (e) {
    // The wrapper passes invalid JSON on as { _parseError, _raw } - mirror it.
    widgetState.conf = { _parseError: String(e), _raw: confEl.value }
    confEl.classList.add('invalid')
  }
})

document.getElementById('theme').addEventListener('change', (e) => {
  const theme = e.target.value
  document.documentElement.setAttribute('theme', theme)
  document.documentElement.setAttribute('color-scheme', theme === 'dark-theme' ? 'dark' : 'light')
})

document.getElementById('cycle').addEventListener('click', () => {
  widgetState.cycle++
})

// Handy in the browser console.
window.widgetState = widgetState
