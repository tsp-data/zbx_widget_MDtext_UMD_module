# Sample document (`url` mode)

This file is served by the Vite dev server from `public/sample.md`.
Point `conf.url` at `/sample.md` to see it - then edit the file and press
**Simulate refresh cycle**: the widget re-reads the document on every cycle.

## Formatting a dashboard note may need

- **bold**, *italic*, ~~strikethrough~~, `inline code`
- a [link to Zabbix](https://www.zabbix.com/) (opens in a new tab)
- raw HTML survives sanitization: <span style="color:#e45959">colored text</span>

| Severity | Colour    |
| -------- | --------- |
| Disaster | `#E45959` |
| High     | `#E97659` |
| Average  | `#FFA059` |

> Blockquotes, code blocks and task lists work too.

```text
$ zabbix_get -s host -k agent.ping
1
```

- [x] build the UMD module
- [ ] deploy it to the wrapper

---

Anything executable is removed: <script>alert('xss')</script><img src=x onerror="alert(1)">
