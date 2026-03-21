<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Reminders

- Theme mode must support `system`, `light`, and `dark` with a visible selector in the UI.
- For Next.js changes, consult the relevant docs under `node_modules/next/dist/docs/` before implementation.
- QR views must validate `lastQrAt`; if the QR is older than 1 minute, show an error and do not render the QR.
