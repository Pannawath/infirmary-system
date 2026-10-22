#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The development app uses the local Next.js backend, including Prisma.
    // Do not ship a release that silently depends on a development server.
    #[cfg(not(debug_assertions))]
    panic!("Release packaging requires the bundled local backend. Use npm run tauri dev for now.");
    #[cfg(debug_assertions)]
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Could not start SPK infirmary");
}
