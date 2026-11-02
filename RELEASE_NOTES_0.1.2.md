# SPK Infirmary v0.1.2 - Desktop startup fix

- Normalize Windows verbatim resource paths before passing them to Node. This fixes a reproduced `EISDIR: lstat 'C:'` startup failure in a relocated application folder.

- Wait for an HTTP health response from this launch's backend and database before navigating. Do not open an unavailable localhost page after a fixed timeout.
- Choose a free loopback port instead of assuming port 3103 is available. Secondary Excel windows use the same origin and port as the main window.
- Resolve installed backend resources from Tauri's resource directory. Show an actionable message when required files are missing.
- Detect early backend exits and allow up to 120 seconds for startup on slower machines.
- Write backend startup diagnostics to `%APPDATA%/th.ac.spk.infirmary/startup.log`.
- Keep the existing database location and preserve existing records. No reset or automatic data deletion during update.
- The installer contains schema only: no databases, student rosters, Excel files, passwords or credentials.

## Install

Download and run **SPK.Infirmary_0.1.2_x64-setup.exe**. Do not copy only the inner application executable: its packaged backend folder is required.

Close any running older version before upgrading. If startup still fails, read the on-screen diagnostic and local startup.log; do not delete the database or post logs containing personal data publicly.

This release targets Windows x64. It is not a macOS build. The installer is not digitally signed.
