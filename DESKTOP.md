# Windows desktop preview

Run `npm run tauri dev` from this project. Tauri starts the local Next.js backend
at `http://127.0.0.1:3103`, with the existing Prisma database (no data reset).
Keep the terminal running while using the app. Only local loopback is exposed.

If this computer's npm shim reports a missing npm-cli.js, use the installed npm:

```powershell
node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run tauri dev
```

The development executable is `src-tauri/target/debug/spk-infirmary.exe`.
It still needs the running local development backend; it is NOT a standalone
installer. Release packaging is intentionally disabled until a production local
backend, per-user database path/migrations and backups are bundled. Do not ship
the school roster inside an installer.

The title bar is integrated into the application: drag its empty area to move
the window; the yellow, green and red controls minimize, maximize/restore and
close. These controls appear only inside Tauri, never as fake browser buttons.
The school emblem is downloaded from the official school website; see
`public/school-logo-source.md`.
