import { Marked } from 'marked'
import DOMPurify from 'dompurify'

/*
 * Markdown -> sanitized HTML.
 *
 * marked parses (CommonMark + GFM: tables, strikethrough, task lists, autolinks),
 * DOMPurify then removes everything that could execute or escape the widget. The
 * sanitizer is the security boundary, not the parser: a document may come from a
 * URL the dashboard author does not control, and even inline text is edited by
 * everyone with dashboard edit rights. That is also why raw HTML inside the
 * Markdown can stay enabled by default - a `<span style="color:...">` in a
 * heading is a legitimate need, and it survives sanitization unchanged.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/*
 * Per-render settings read by the DOMPurify hook below. DOMPurify hooks are
 * registered once per instance, so the values travel through module state; every
 * render sets them right before sanitize(), and rendering is synchronous.
 */
let linkTarget = '_blank'
let baseUrl = null

const URL_ATTRIBUTES = { A: 'href', IMG: 'src' }

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const attr = URL_ATTRIBUTES[node.tagName]
  if (!attr || !node.hasAttribute(attr)) return

  /*
   * A document loaded from a URL keeps its own neighbourhood: `![](legend.svg)`
   * or `[details](details.md)` next to it resolve against the document's URL,
   * not against the dashboard page - so a folder of Markdown plus images works
   * as it does in any Markdown viewer. Inline text has no such base; its
   * relative URLs resolve against the page as usual. Unsafe schemes are already
   * gone at this point, DOMPurify strips them before this hook runs.
   */
  const value = node.getAttribute(attr)
  if (baseUrl && !value.startsWith('#')) {
    try {
      node.setAttribute(attr, new URL(value, baseUrl).href)
    } catch {
      // not a URL - leave it to the browser
    }
  }

  /*
   * Links open outside the dashboard by default: a click that navigates the
   * dashboard page away is almost never what a wallboard wants. DOMPurify drops
   * `target` while sanitizing, so it is re-added here (the documented DOMPurify
   * recipe), together with rel=noopener.
   */
  if (node.tagName === 'A') {
    if (linkTarget === '_blank') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    } else {
      node.removeAttribute('target')
    }
  }
})

const PURIFY_OPTIONS = {
  // A <style> element would restyle the whole dashboard page, not just this widget.
  FORBID_TAGS: ['style'],
}

/**
 * Render Markdown to HTML that is safe to insert with v-html.
 *
 * @param {string} markdown
 * @param {{ html?: boolean, breaks?: boolean, links?: 'new-tab' | 'same-tab', baseUrl?: string }} [opts]
 *   html    - pass raw HTML in the Markdown through (sanitized) instead of escaping it
 *   breaks  - render a single newline as a line break (GFM style)
 *   links   - where links open
 *   baseUrl - URL the document came from; relative links and images resolve against it
 * @returns {string}
 */
export function renderMarkdown(markdown, opts = {}) {
  const { html = true, breaks = true, links = 'new-tab', baseUrl: base } = opts

  if (typeof markdown !== 'string' || markdown === '') {
    return ''
  }

  const parser = new Marked({
    gfm: true,
    breaks,
    ...(html
      ? {}
      : {
          renderer: {
            html(token) {
              return escapeHtml(typeof token === 'string' ? token : token.text)
            },
          },
        }),
  })

  const raw = parser.parse(markdown)

  linkTarget = links === 'same-tab' ? '_self' : '_blank'
  baseUrl = null
  if (base) {
    try {
      // The document URL may itself be relative to the dashboard page.
      baseUrl = new URL(base, window.location.href).href
    } catch {
      baseUrl = null
    }
  }

  return DOMPurify.sanitize(raw, PURIFY_OPTIONS)
}
