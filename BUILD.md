# BUILD and Development (`MDtext`)

This document explains how to run the module in local development mode, build UMD artifacts,
and deploy them for use with the Zabbix `js_wrapper` module.

## Project Origin

The project follows the structure of `zbx_widget_hosts_alarms_UMD_module`, whose skeleton was
created following the official Vue Quick Start approach:

- https://vuejs.org/guide/quick-start

## 1. Prerequisites

- Node.js version compatible with `package.json` engines (`^20.19.0 || >=22.12.0`)
- npm

## 2. Install Dependencies

```sh
cd zbx_widget_MDtext_UMD_module
npm install
```

## 3. Local Development (outside Zabbix)

During development you can run the widget as a standalone Vue app, without Zabbix:

```sh
npm run dev
```

The page (`index.html`, `src/main.js`) emulates the Zabbix widget body:

- a resizable container with the colours of the Zabbix blue or dark theme (theme switch),
- a `conf (JSON)` textarea applied live, like the widget configuration field - invalid JSON is
  passed on the way the wrapper does it (`{ _parseError, _raw }`),
- a button that simulates one refresh cycle (the wrapper's `update()` call),
- `public/sample.md`, reachable as `"url": "/sample.md"`, to exercise the url mode.

Benefits:

- fast frontend iteration with Vite hot reload,
- ability to inspect component state and tree via Vue DevTools.

## 4. Build UMD Library for Zabbix Wrapper

To build deployable UMD artifacts used by `js_wrapper`:

```sh
npm run build:lib
```

Build configuration is in `vite.lib.config.js`.

Expected outputs:

- `dist/MDtext.umd.js`
- `dist/MDtext.css`

Note: Vue, marked and DOMPurify are bundled directly into the UMD file (not externalized).

## 5. Deploy Artifacts to `js_wrapper`

Copy the built files into the wrapper assets of a Zabbix frontend (path of the Zabbix 7.0
packages shown; adjust to your installation):

```sh
ZABBIX_MODULES_DIR=/usr/share/zabbix/ui/modules
cp dist/MDtext.umd.js "$ZABBIX_MODULES_DIR/js_wrapper/assets/umd/MDtext.umd.js"
cp dist/MDtext.css "$ZABBIX_MODULES_DIR/js_wrapper/assets/umd/MDtext.css"
```

or, to a remote frontend:

```sh
scp dist/MDtext.umd.js dist/MDtext.css root@zabbix-frontend:/usr/share/zabbix/ui/modules/js_wrapper/assets/umd/
```

Use a plain copy - not `cp -p` or `rsync -a`, which preserve the modification time the wrapper
uses for cache busting (see "Cache Busting" in the `js_wrapper` README). No other step is
needed; browsers pick the new build up on the next dashboard load.

Then in the Zabbix widget configuration (widget type `JS wrapper`) set:

- `component`: `MDtext`
- `conf_json`: valid JSON - see "Configuration" in `README.md`

Example `conf_json` (inline text):

```json
{
    "text": "# Production overview\nContact: NOC, ext. 1234",
    "align": "center",
    "valign": "middle",
    "scale": 1.5
}
```

Example `conf_json` (document next to the module):

```json
{
    "url": "modules/js_wrapper/assets/md/overview.md"
}
```

## 6. Optional Commands

Lint and formatting helpers:

```sh
npm run lint
npm run format
```

## 7. Troubleshooting

- If the widget does not load in Zabbix, verify both files exist in `js_wrapper/assets/umd/`.
- If the global API is not found, check that `src/entry.js` publishes `window.MDtext` and that
  the widget's `component` is spelled `MDtext` (the name is case-sensitive: it is a file name).
- If UI renders in local dev but not in Zabbix, re-check wrapper `component` value and artifact
  file names.
- "Cannot load <url>" in the url mode: the browser blocked the request - almost always a missing
  `Access-Control-Allow-Origin` header on a cross-origin server, or an `http://` document on an
  `https://` dashboard. The browser console (Network tab) names the reason; see "Loading from a
  URL" in `README.md`.
- If the script fails with `ReferenceError: process is not defined`, the build predates the
  top-level `define` in `vite.lib.config.js` - rebuild.
