import { createApp, reactive } from 'vue'
import App from './App.vue'

// Name under which the js_wrapper reaches this module: window.MDtext.
const COMPONENT_NAME = 'MDtext'

const api = {
  mount(el, opts = {}) {
    const { conf, context, zbx } = opts

    // Shared reactive state injected into App.vue. The wrapper replaces it on
    // every refresh cycle through update() below.
    const widgetState = reactive({
      conf: conf ?? {},
      context: context ?? {},
      zbx: zbx ?? {},
      // Counts the wrapper's update() calls - one per Zabbix refresh cycle. It is
      // the only clock this module has (a module must not run its own timer, see
      // "Refresh is driven by Zabbix" in the js_wrapper README); the url mode
      // re-reads its document on every tick.
      cycle: 0,
    })

    const app = createApp(App)
    app.provide('widgetState', widgetState)
    app.mount(el)

    return {
      // Called by the wrapper when the widget is removed or replaced.
      destroy() {
        app.unmount()
      },

      // Called by the wrapper on every refresh cycle, without remount.
      update(payload = {}) {
        widgetState.conf = payload.conf ?? {}
        widgetState.context = payload.context ?? {}
        widgetState.zbx = payload.zbx ?? {}
        widgetState.cycle++
      },
    }
  },
}

window[COMPONENT_NAME] = api
