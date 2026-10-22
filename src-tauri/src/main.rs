#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

struct BackendProcess(Mutex<Option<Child>>);

fn find_backend_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?;

    // Check Tauri resource directory locations
    let candidates = [
        exe_dir.join("resources").join("backend"),
        exe_dir.join("backend"),
        PathBuf::from("src-tauri").join("backend"),
        PathBuf::from("backend"),
    ];

    for candidate in candidates {
        if candidate.join("node.exe").exists() && candidate.join("server.js").exists() {
            return Some(candidate);
        }
    }
    None
}

fn setup_database(backend_dir: &Path) -> Result<PathBuf, String> {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    let db_dir = PathBuf::from(app_data).join("th.ac.spk.infirmary");
    fs::create_dir_all(&db_dir).map_err(|e| format!("Failed to create AppData directory: {}", e))?;

    let target_db = db_dir.join("infirmary.db");
    if !target_db.exists() {
        let initial_db = backend_dir.join("initial.db");
        if initial_db.exists() {
            fs::copy(&initial_db, &target_db)
                .map_err(|e| format!("Failed to copy initial database: {}", e))?;
        }
    }

    Ok(target_db)
}

fn start_backend() -> Option<Child> {
    let backend_dir = find_backend_dir()?;
    let target_db = match setup_database(&backend_dir) {
        Ok(path) => path,
        Err(err) => {
            eprintln!("Database setup warning: {}", err);
            backend_dir.join("initial.db")
        }
    };

    let node_exe = backend_dir.join("node.exe");
    let db_url = format!("file:{}", target_db.to_string_lossy().replace('\\', "/"));

    let mut cmd = Command::new(&node_exe);
    cmd.current_dir(&backend_dir)
        .arg("server.js")
        .env("PORT", "3103")
        .env("HOSTNAME", "127.0.0.1")
        .env("NODE_ENV", "production")
        .env("INFIRMARY_DATABASE_URL", &db_url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.spawn() {
        Ok(child) => Some(child),
        Err(err) => {
            eprintln!("Failed to spawn local backend server: {}", err);
            None
        }
    }
}

#[allow(dead_code)]
fn wait_for_backend() {
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(20) {
        if TcpStream::connect("127.0.0.1:3103").is_ok() {
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

fn main() {
    let backend_child = if cfg!(not(debug_assertions)) {
        start_backend()
    } else {
        None
    };

    let app = tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(backend_child)))
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            {
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    wait_for_backend();
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if let Ok(target_url) = "http://127.0.0.1:3103".parse() {
                            let _ = window.navigate(target_url);
                        }
                    }
                });
            }
            #[cfg(debug_assertions)]
            let _ = app;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Could not start SPK infirmary");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<BackendProcess>() {
                if let Ok(mut lock) = state.0.lock() {
                    if let Some(mut child) = lock.take() {
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}
