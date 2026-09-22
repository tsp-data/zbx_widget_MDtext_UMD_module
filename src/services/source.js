/**
 * Error loading a Markdown document. `message` is short enough for the widget
 * body, `detail` carries the explanation shown underneath (or in a tooltip).
 */
export class SourceError extends Error {
  /**
   * @param {string} message
   * @param {string} [detail]
   */
  constructor(message, detail) {
    super(message)
    this.name = 'SourceError'
    this.detail = detail
  }
}

const FETCH_FAILED_DETAIL =
  'The browser refused or failed the request and hides the reason by design. Typical causes: ' +
  'the server does not send an Access-Control-Allow-Origin header (CORS, cross-origin URLs only), ' +
  'an http:// URL on an https:// dashboard (mixed content), or the host is unreachable. ' +
  'See "Loading from a URL" in README.md.'

/**
 * Load a Markdown document over HTTP(S) from the browser of the dashboard viewer.
 *
 * Runs as a plain GET with no custom headers (so no CORS preflight) and
 * `credentials: 'same-origin'` (cookies only to the Zabbix frontend's own origin).
 * `cache: 'no-cache'` makes every refresh cycle revalidate with the server, so an
 * edited document shows up on the next cycle while an unchanged one costs a 304.
 *
 * @param {string} url  Absolute, or relative to the Zabbix frontend page
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchMarkdown(url, opts = {}) {
  const { signal, timeoutMs = 10000 } = opts

  const ac = new AbortController()
  const onAbort = () => ac.abort()
  signal?.addEventListener('abort', onAbort)

  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    ac.abort()
  }, timeoutMs)

  try {
    let res
    try {
      res = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
        credentials: 'same-origin',
        signal: ac.signal,
      })
    } catch (e) {
      if (signal?.aborted) throw e // the caller cancelled - not an error to show
      if (timedOut) {
        throw new SourceError(`Timed out after ${timeoutMs / 1000} s loading ${url}`)
      }
      throw new SourceError(`Cannot load ${url}`, FETCH_FAILED_DETAIL)
    }

    if (!res.ok) {
      throw new SourceError(
        `HTTP ${res.status} ${res.statusText} loading ${url}`.replace(/\s+/g, ' '),
      )
    }

    return await res.text()
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
