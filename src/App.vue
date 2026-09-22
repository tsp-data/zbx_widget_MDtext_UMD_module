<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { renderMarkdown } from './services/markdown.js'
import { fetchMarkdown } from './services/source.js'

/*
 * Shared reactive state, provided by entry.js (inside Zabbix) or main.js
 * (standalone development). The wrapper replaces `conf` on every refresh cycle
 * and bumps `cycle`; that is the only clock this widget has - see "Refresh is
 * driven by Zabbix" in the js_wrapper README.
 */
const state = inject('widgetState')

const conf = computed(() => (state.conf && typeof state.conf === 'object' ? state.conf : {}))

const ALIGN = ['left', 'center', 'right', 'justify']
const VALIGN = ['top', 'middle', 'bottom']

/**
 * Where the Markdown comes from. Derived from the configuration; the watcher
 * below compares it by value, because the wrapper hands over a new `conf`
 * object on every cycle even when nothing changed.
 */
const source = computed(() => {
  const c = conf.value

  if (c._parseError) {
    return {
      kind: 'invalid',
      message: 'conf (JSON) is not valid JSON.',
      detail: String(c._parseError),
    }
  }
  if (typeof c.url === 'string' && c.url.trim() !== '') {
    return { kind: 'url', url: c.url.trim() }
  }
  if (typeof c.text === 'string' && c.text !== '') {
    return { kind: 'text', text: c.text }
  }
  return { kind: 'empty' }
})

const remoteText = ref('') // last successfully loaded document (url mode)
const loadError = ref(null) // { message, detail } of the last failed load; null after a success
let inflight = null // AbortController of the running fetch, if any

const markdown = computed(() => {
  const s = source.value
  if (s.kind === 'url') return remoteText.value
  if (s.kind === 'text') return s.text
  return ''
})

const html = computed(() =>
  renderMarkdown(markdown.value, {
    html: conf.value.html !== false,
    breaks: conf.value.breaks !== false,
    links: conf.value.links === 'same-tab' ? 'same-tab' : 'new-tab',
  }),
)

/** The error to show, if any: configuration problems first, then the load state. */
const error = computed(() => {
  const s = source.value
  if (s.kind === 'invalid') return { message: s.message, detail: s.detail }
  if (s.kind === 'empty')
    return { message: 'Nothing to display: set "text" or "url" in conf (JSON).' }
  return loadError.value
})

const rootClass = computed(() => {
  const c = conf.value
  const valign = VALIGN.includes(c.valign) ? c.valign : 'top'
  return ['zbx-mdtext', `zbx-mdtext--valign-${valign}`, typeof c.class === 'string' ? c.class : '']
})

const rootStyle = computed(() => {
  const c = conf.value
  const style = {}

  // A number scales the font size the dashboard gives us; a string is a CSS value.
  if (typeof c.scale === 'number' && Number.isFinite(c.scale) && c.scale > 0) {
    style.fontSize = `${c.scale}em`
  } else if (typeof c.scale === 'string' && c.scale.trim() !== '') {
    style.fontSize = c.scale.trim()
  }

  if (ALIGN.includes(c.align)) {
    style.textAlign = c.align
  }

  return style
})

/**
 * Load the document of the url mode. A newer load cancels an older one, so a
 * slow response can never overwrite a newer document.
 */
async function load() {
  const s = source.value
  if (s.kind !== 'url') return

  inflight?.abort()
  const ac = new AbortController()
  inflight = ac

  try {
    const text = await fetchMarkdown(s.url, { signal: ac.signal })
    if (ac.signal.aborted) return
    remoteText.value = text
    loadError.value = null
  } catch (e) {
    if (ac.signal.aborted) return
    loadError.value = { message: e.message, detail: e.detail }
    console.error('[MDtext] loading failed:', s.url, e)
  } finally {
    if (inflight === ac) inflight = null
  }
}

// A changed source: drop the old document and load the new one.
watch(
  source,
  (next, prev) => {
    if (prev && next.kind === prev.kind && next.url === prev.url) return
    remoteText.value = ''
    loadError.value = null
    load()
  },
  { immediate: true },
)

// Every Zabbix refresh cycle re-reads the document, so an edited file shows up
// without touching the widget. The text mode has nothing to refresh.
watch(
  () => state.cycle,
  () => load(),
)

onBeforeUnmount(() => inflight?.abort())
</script>

<template>
  <div :class="rootClass" :style="rootStyle">
    <div v-if="error && !markdown" class="zbx-mdtext-error zbx-mdtext-error--full">
      <div>{{ error.message }}</div>
      <div v-if="error.detail" class="zbx-mdtext-error-detail">{{ error.detail }}</div>
    </div>
    <template v-else>
      <div class="zbx-mdtext-body" v-html="html"></div>
      <div
        v-if="error"
        class="zbx-mdtext-error zbx-mdtext-error--footer"
        :title="error.detail ?? error.message"
      >
        {{ error.message }}
      </div>
    </template>
  </div>
</template>

<style>
/*
 * Not scoped on purpose: the rendered Markdown arrives through v-html, which
 * scoped styles cannot reach. Every rule is prefixed instead, so nothing leaks
 * into the dashboard page.
 *
 * No colours of its own: text inherits the widget body colour of the active
 * Zabbix theme, links keep the theme's <a> style, and the subtle surfaces are
 * mixed from the current text colour - correct in the light, dark and
 * high-contrast themes alike, with no knowledge of which one is active.
 */
.zbx-mdtext {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
  color: inherit;
  background: transparent;
  line-height: 1.4;
  overflow-wrap: break-word;
}

/*
 * Vertical placement through auto margins rather than justify-content: with
 * justify-content: center an overflowing document loses its top edge, while
 * auto margins collapse to zero when there is no room and the body just scrolls.
 */
.zbx-mdtext--valign-top .zbx-mdtext-body {
  margin-bottom: auto;
}
.zbx-mdtext--valign-middle .zbx-mdtext-body {
  margin-top: auto;
  margin-bottom: auto;
}
.zbx-mdtext--valign-bottom .zbx-mdtext-body {
  margin-top: auto;
}

.zbx-mdtext-body > :first-child {
  margin-top: 0;
}
.zbx-mdtext-body > :last-child {
  margin-bottom: 0;
}

/* The Zabbix themes reset h1-h3, pre, table and blockquote globally - restate everything. */
.zbx-mdtext-body h1,
.zbx-mdtext-body h2,
.zbx-mdtext-body h3,
.zbx-mdtext-body h4,
.zbx-mdtext-body h5,
.zbx-mdtext-body h6 {
  margin: 0.6em 0 0.3em;
  font-weight: 600;
  line-height: 1.2;
  color: inherit;
}
.zbx-mdtext-body h1 {
  font-size: 2em;
}
.zbx-mdtext-body h2 {
  font-size: 1.6em;
}
.zbx-mdtext-body h3 {
  font-size: 1.3em;
}
.zbx-mdtext-body h4 {
  font-size: 1.1em;
}
.zbx-mdtext-body h5 {
  font-size: 1em;
}
.zbx-mdtext-body h6 {
  font-size: 0.9em;
  opacity: 0.8;
}

.zbx-mdtext-body p {
  margin: 0.5em 0;
}

.zbx-mdtext-body ul,
.zbx-mdtext-body ol {
  margin: 0.5em 0;
  padding-left: 1.6em;
}
.zbx-mdtext-body ul {
  list-style: disc;
}
.zbx-mdtext-body ol {
  list-style: decimal;
}
.zbx-mdtext-body li {
  margin: 0.15em 0;
}
.zbx-mdtext-body li > ul,
.zbx-mdtext-body li > ol {
  margin: 0.1em 0;
}
.zbx-mdtext-body input[type='checkbox'] {
  margin: 0 0.4em 0 0;
  vertical-align: middle;
}

.zbx-mdtext-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  padding: 0.1em 0.35em;
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.zbx-mdtext-body pre {
  margin: 0.6em 0;
  padding: 0.6em 0.8em;
  overflow: auto;
  border-radius: 4px;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.zbx-mdtext-body pre code {
  padding: 0;
  background: none;
}

.zbx-mdtext-body blockquote {
  margin: 0.6em 0;
  padding: 0.2em 0.9em;
  border-left: 3px solid color-mix(in srgb, currentColor 30%, transparent);
  opacity: 0.85;
}

.zbx-mdtext-body table {
  border-collapse: collapse;
  margin: 0.6em 0;
}
.zbx-mdtext-body th,
.zbx-mdtext-body td {
  padding: 0.25em 0.6em;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  text-align: left;
  vertical-align: top;
}
.zbx-mdtext-body th {
  font-weight: 600;
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.zbx-mdtext-body hr {
  margin: 0.8em 0;
  border: 0;
  border-top: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}

.zbx-mdtext-body img {
  max-width: 100%;
  height: auto;
}

/* Zabbix "Disaster" red - legible on every theme. */
.zbx-mdtext-error {
  color: #e45959;
  font-size: 0.9em;
}
.zbx-mdtext-error--full {
  margin: auto 0;
  white-space: pre-wrap;
}
.zbx-mdtext-error--footer {
  flex: none;
  padding-top: 0.4em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.zbx-mdtext-error-detail {
  margin-top: 0.4em;
  opacity: 0.85;
  font-size: 0.9em;
}
</style>
