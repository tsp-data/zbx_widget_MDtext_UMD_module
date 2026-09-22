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
 * Links open outside the dashboard by default: a click that navigates the
 * dashboard page away is almost never what a wallboard wants. DOMPurify drops
 * `target` while sanitizing, so it is re-added in a hook afterwards (the
 * documented DOMPurify recipe), together with rel=noopener.
 */
let linkTarget = '_blank'

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
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
 * @param {{ html?: boolean, breaks?: boolean, links?: 'new-tab' | 'same-tab' }} [opts]
 *   html   - pass raw HTML in the Markdown through (sanitized) instead of escaping it
 *   breaks - render a single newline as a line break (GFM style)
 *   links  - where links open
 * @returns {string}
 */
export function renderMarkdown(markdown, opts = {}) {
  const { html = true, breaks = true, links = 'new-tab' } = opts

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
  return DOMPurify.sanitize(raw, PURIFY_OPTIONS)
}
