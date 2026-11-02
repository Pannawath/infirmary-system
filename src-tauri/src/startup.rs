use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::Manager;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

struct BackendProcess(Mutex<Option<Child>>);
// Tauri may return verbatim Windows paths. Node's JS module loader cannot
// resolve a main script prefixed with \\?\ (it can fail with EISDIR on C:).
fn node_path(path: &Path) -> PathBuf {
    let value = path.to_string_lossy();
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") { return PathBuf::from(format!(r"\\{rest}")); }
    if let Some(rest) = value.strip_prefix(r"\\?\") { return PathBuf::from(rest); }
    path.to_path_buf()
}
fn backend_dir(resource: &Path, executable: &Path) -> Result<PathBuf, String> {
    for dir in [resource.join("backend"), executable.join("backend")] {
        if ["node.exe", "server.js", "desktop-bootstrap.cjs", "schema.sql", ".next/BUILD_ID"].iter().all(|name| dir.join(name).is_file()) { return Ok(dir); }
    }
    Err("Backend resources are missing. Install using the full setup installer; do not copy only the application EXE.".into())
}
fn available_port() -> Result<u16, String> {
    let socket = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Cannot reserve a local port: {e}"))?;
    socket.local_addr().map(|a| a.port()).map_err(|e| e.to_string())
}
fn ready(port: u16, nonce: &str) -> bool {
    let address = format!("127.0.0.1:{port}").parse().unwrap();
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(500)) else { return false; };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(750)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(750)));
    if write!(stream, "GET /api/desktop-health HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").is_err() { return false; }
    let mut bytes = Vec::new();
    // Windows can report ConnectionReset after delivering a complete HTTP reply.
    // Judge the bounded reply we actually received rather than discarding it.
    let _ = stream.take(16384).read_to_end(&mut bytes);
    let response = String::from_utf8_lossy(&bytes);
    (response.starts_with("HTTP/1.1 200 ") || response.starts_with("HTTP/1.0 200 ")) && response.contains("spk-infirmary") && response.contains(nonce)
}
fn start_backend(dir: &Path, data: &Path, port: u16, nonce: &str) -> Result<Child, String> {
    fs::create_dir_all(data).map_err(|e| format!("Cannot create application data directory: {e}"))?;
    let log = OpenOptions::new().create(true).append(true).open(data.join("startup.log")).map_err(|e| e.to_string())?;
    let mut info = log.try_clone().map_err(|e| e.to_string())?;
    let _ = writeln!(info, "\nSPK {} startup: backend={} port={port}", env!("CARGO_PKG_VERSION"), dir.display());
    let errors = log.try_clone().map_err(|e| e.to_string())?;
    let mut command = Command::new(dir.join("node.exe"));
    command.current_dir(dir).arg(dir.join("desktop-bootstrap.cjs"))
        .env("PORT", port.to_string()).env("HOSTNAME", "127.0.0.1").env("NODE_ENV", "production")
        .env("INFIRMARY_DATABASE_URL", format!("file:{}", data.join("infirmary.db").to_string_lossy().replace('\\', "/")))
        .env("INFIRMARY_STARTUP_NONCE", nonce)
        .env_remove("NODE_OPTIONS").env_remove("NODE_PATH").env_remove("INFIRMARY_DESKTOP_TOKEN")
        .stdin(Stdio::null()).stdout(Stdio::from(log)).stderr(Stdio::from(errors));
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    command.spawn().map_err(|e| format!("Cannot start bundled Node runtime: {e}"))
}
fn show_error(app: &tauri::AppHandle, data: &Path, message: &str) {
    let log_path = data.join("startup.log");
    if let Ok(mut log) = OpenOptions::new().create(true).append(true).open(&log_path) { let _ = writeln!(log, "STARTUP ERROR: {message}"); }
    if let Some(window) = app.get_webview_window("main") {
        let details = serde_json::to_string(&format!("{message}\n\nDiagnostics: {}\nClose and reopen the app after resolving the issue. Existing data has not been reset.", log_path.display())).unwrap();
        let _ = window.eval(&format!("window.spkStartupError=true;document.getElementById('title').textContent='Unable to start the application';document.getElementById('status').textContent={details};document.querySelector('.spinner').hidden=true;"));
    }
}
fn launch(app: tauri::AppHandle) {
    // Preserve the exact location used by previous Windows releases.
    let data = match std::env::var_os("APPDATA").map(|p| PathBuf::from(p).join("th.ac.spk.infirmary")).or_else(|| app.path().app_data_dir().ok()) {
        Some(p) => p, None => return,
    };
    let result = (|| -> Result<(), String> {
        fs::create_dir_all(&data).map_err(|e| e.to_string())?;
        let resource = app.path().resource_dir().map_err(|e| e.to_string())?;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let dir = node_path(&backend_dir(&resource, exe.parent().ok_or("Missing executable directory")?)?);
        let port = available_port()?;
        // Readiness identifier only; this is not an authentication credential.
        let nonce = format!("spk-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
        let child = start_backend(&dir, &data, port, &nonce)?;
        let state = app.state::<BackendProcess>();
        *state.0.lock().map_err(|_| "Backend process lock failed")? = Some(child);
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(120) {
            if let Some(child) = state.0.lock().map_err(|_| "Backend lock failed")?.as_mut() {
                if let Some(status) = child.try_wait().map_err(|e| e.to_string())? { return Err(format!("Local backend exited before it was ready ({status}). See startup.log for the original error.")); }
            }
            if ready(port, &nonce) {
                if let Some(window) = app.get_webview_window("main") { window.navigate(format!("http://127.0.0.1:{port}").parse().map_err(|_| "Invalid local URL")?).map_err(|e| e.to_string())?; }
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(150));
        }
        Err("Backend startup timed out after 120 seconds. Check startup.log; the app has not navigated to an unavailable server.".into())
    })();
    if let Err(error) = result { show_error(&app, &data, &error); }
}
pub fn run() {
    let app = tauri::Builder::default().manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            { let handle = app.handle().clone(); std::thread::spawn(move || launch(handle)); }
            #[cfg(debug_assertions)] let _ = app;
            Ok(())
        }).build(tauri::generate_context!()).expect("Could not start SPK infirmary");
    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = handle.try_state::<BackendProcess>() {
                if let Ok(mut lock) = state.0.lock() { if let Some(mut child) = lock.take() { let _ = child.kill(); let _ = child.wait(); } }
            }
        }
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn chooses_a_free_port_when_3103_is_busy() { let _busy = TcpListener::bind("127.0.0.1:3103"); let p = available_port().unwrap(); assert_ne!(p, 3103); }
    #[test] fn refuses_a_tcp_service_that_is_not_our_backend() {
        let socket=TcpListener::bind("127.0.0.1:0").unwrap();let p=socket.local_addr().unwrap().port();
        let server=std::thread::spawn(move || { let (mut s,_)=socket.accept().unwrap();let mut buf=[0;2048];let _=s.read(&mut buf);let _=s.write_all(b"HTTP/1.0 200 OK\r\n\r\nnot-the-backend"); });
        assert!(!ready(p,"our-nonce"));server.join().unwrap();
    }
    #[test] fn missing_resources_fail_without_connecting_to_a_web_page() { assert!(backend_dir(Path::new("missing-resources"),Path::new("missing-exe")).is_err()); }
    #[test] fn normalizes_windows_paths_for_the_node_loader() {
        assert_eq!(node_path(Path::new(r"\\?\C:\Program Files\SPK\backend")),PathBuf::from(r"C:\Program Files\SPK\backend"));
        assert_eq!(node_path(Path::new(r"\\?\UNC\server\share\backend")),PathBuf::from(r"\\server\share\backend"));
    }
    #[test] fn accepts_only_the_matching_healthy_backend() {
        let socket=TcpListener::bind("127.0.0.1:0").unwrap();let p=socket.local_addr().unwrap().port();
        let server=std::thread::spawn(move || { let (mut s,_)=socket.accept().unwrap();let mut buf=[0;2048];let _=s.read(&mut buf);let _=s.write_all(b"HTTP/1.0 200 OK\r\n\r\n{\"application\":\"spk-infirmary\",\"startupNonce\":\"test-nonce\"}"); });
        assert!(ready(p,"test-nonce"));server.join().unwrap();
    }
}
