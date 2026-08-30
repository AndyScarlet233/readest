//! The axum router + handlers backing the LAN sync server. Endpoint semantics
//! map 1:1 onto the `FileSyncProvider` methods in
//! `services/sync/file/provider.ts`:
//!
//!   GET  /ping            → pairing probe (LanForm "test connection")
//!   GET  /files/{path}    → readText / readBinary (404 = absent)
//!   HEAD /files/{path}    → head (Content-Length + ETag for the short-circuit)
//!   PUT  /files/{path}    → writeText / writeBinary (parent dirs auto-created)
//!   DEL  /files/{path}    → deleteDir (recursive; missing = success)
//!   POST /list {dir}      → list (immediate children, engine-style entries)
//!
//! Book files are buffered in memory today; the M2 streaming endpoints will
//! move large EPUBs to chunked transfer without changing these shapes.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Path as AxumPath, Request, State};
use axum::http::{header, HeaderValue, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use tokio::io::AsyncWriteExt;
use tokio_util::io::ReaderStream;

/// Upper bound for one request body (book binaries ride PUTs). Axum's default
/// is 2 MiB, which silently 413-rejects nearly every real book; 2 GiB leaves
/// room for the largest comics/PDFs while still bounding a malicious peer.
const MAX_BODY_BYTES: usize = 2 * 1024 * 1024 * 1024;

pub struct ServerState {
    /// On-disk root of the remote-format tree (`.../LanSync/`).
    pub root: PathBuf,
    /// Shared pairing token; every request must present it as a Bearer.
    pub token: String,
    pub device_name: String,
    pub device_id: String,
}

pub fn router(state: Arc<ServerState>) -> Router {
    Router::new()
        .route("/ping", get(ping))
        .route(
            "/files/{*path}",
            get(read_file).head(head_file).put(write_file).delete(delete_path),
        )
        .route("/list", post(list_dir))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_and_cors,
        ))
        .with_state(state)
}

/// Bearer-token gate + permissive CORS (the peer is a webview page on
/// `tauri://localhost`-ish origins, so preflights must be answered and every
/// response must be readable cross-origin).
async fn auth_and_cors(
    State(state): State<Arc<ServerState>>,
    req: Request,
    next: Next,
) -> Response {
    if req.method() == Method::OPTIONS {
        return with_cors(StatusCode::NO_CONTENT.into_response());
    }
    let expected = format!("Bearer {}", state.token);
    let authorized = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v == expected);
    if !authorized {
        return with_cors((StatusCode::UNAUTHORIZED, "unauthorized").into_response());
    }
    with_cors(next.run(req).await)
}

fn with_cors(mut res: Response) -> Response {
    let headers = res.headers_mut();
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, HEAD, PUT, DELETE, POST, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Authorization, Content-Type"),
    );
    headers.insert(header::ACCESS_CONTROL_MAX_AGE, HeaderValue::from_static("86400"));
    res
}

/// Join a request path onto the root, refusing anything that could escape it.
/// `..` is rejected outright; so are `\` (a path separator on Windows that
/// would smuggle extra segments), NUL, and `:` (illegal in Windows filenames,
/// therefore never present in the frozen layout).
fn safe_join(root: &std::path::Path, rel: &str) -> Option<PathBuf> {
    if rel.is_empty() {
        return None;
    }
    let mut out = root.to_path_buf();
    for segment in rel.split('/') {
        match segment {
            "" | "." => {}
            ".." => return None,
            s => {
                if s.contains('\\') || s.contains('\0') || s.contains(':') {
                    return None;
                }
                out.push(s);
            }
        }
    }
    if out.starts_with(root) {
        Some(out)
    } else {
        None
    }
}

fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "not found").into_response()
}

fn bad_request(msg: &str) -> Response {
    (StatusCode::BAD_REQUEST, msg.to_string()).into_response()
}

fn internal_error(err: std::io::Error) -> Response {
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()).into_response()
}

fn etag_for(meta: &std::fs::Metadata) -> String {
    let size = meta.len();
    let secs = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("\"{size:x}-{secs:x}\"")
}

async fn ping(State(state): State<Arc<ServerState>>) -> Response {
    with_cors(
        Json(json!({
            "name": state.device_name,
            "device_id": state.device_id,
            "protocol": "readest-lan-sync-1",
        }))
        .into_response(),
    )
}

async fn read_file(
    State(state): State<Arc<ServerState>>,
    AxumPath(path): AxumPath<String>,
) -> Response {
    let Some(full) = safe_join(&state.root, &path) else {
        return bad_request("invalid path");
    };
    // Stream from disk instead of reading the whole file into memory: book
    // binaries are large, and this handler runs in the same native process
    // as the webview (a buffered 100 MB read starves the UI on phones).
    // Content-Length is set explicitly — the peer's download progress bar
    // derives from it.
    let file = match tokio::fs::File::open(&full).await {
        Ok(file) => file,
        Err(_) => return not_found(),
    };
    let meta = match file.metadata().await {
        Ok(meta) if meta.is_file() => meta,
        _ => return not_found(),
    };
    let size = meta.len();
    let etag = etag_for(&meta);
    let stream = ReaderStream::with_capacity(file, 64 * 1024);
    with_cors(
        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_LENGTH, size)
            .header(header::CONTENT_TYPE, "application/octet-stream")
            .header(header::ETAG, etag)
            .body(Body::from_stream(stream))
            .expect("static read response"),
    )
}

async fn head_file(
    State(state): State<Arc<ServerState>>,
    AxumPath(path): AxumPath<String>,
) -> Response {
    let Some(full) = safe_join(&state.root, &path) else {
        return bad_request("invalid path");
    };
    match tokio::fs::metadata(&full).await {
        Ok(meta) if meta.is_file() => {
            let size = meta.len();
            let etag = etag_for(&meta);
            with_cors(
                Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_LENGTH, size)
                    .header(header::CONTENT_TYPE, "application/octet-stream")
                    .header(header::ETAG, etag)
                    .body(Body::empty())
                    .expect("static head response"),
            )
        }
        Ok(_) => not_found(),
        Err(_) => not_found(),
    }
}

/// Best-effort removal of a `.part` temp file when a streaming write is
/// abandoned (handler error, or the future dropped mid-transfer because the
/// peer disconnected — Drop can't await, so the cleanup is spawned).
struct PartFileGuard {
    path: PathBuf,
    armed: bool,
}

impl PartFileGuard {
    fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for PartFileGuard {
    fn drop(&mut self) {
        if self.armed {
            let path = self.path.clone();
            tokio::spawn(async move {
                let _ = tokio::fs::remove_file(&path).await;
            });
        }
    }
}

async fn write_file(
    State(state): State<Arc<ServerState>>,
    AxumPath(path): AxumPath<String>,
    body: Body,
) -> Response {
    let Some(full) = safe_join(&state.root, &path) else {
        return bad_request("invalid path");
    };
    if let Some(parent) = full.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return internal_error(e);
        }
    }
    // Stream the request body to a same-directory `.part` temp file and rename
    // atomically on completion. Buffering the whole body first (the previous
    // implementation) spiked to ~2x the file size in RAM and starved the UI on
    // phones; streaming keeps memory O(chunk). A connection that dies
    // mid-transfer leaves no truncated book behind for the discovery scan to
    // mistake for a complete upload (the engine skips `.part` names anyway).
    let mut part_os = full.clone().into_os_string();
    part_os.push(".part");
    let part_path = PathBuf::from(part_os);

    let file = match tokio::fs::File::create(&part_path).await {
        Ok(file) => file,
        Err(e) => return internal_error(e),
    };
    let mut guard = PartFileGuard {
        path: part_path.clone(),
        armed: true,
    };
    let mut writer = tokio::io::BufWriter::new(file);
    let mut stream = body.into_data_stream();
    while let Some(frame) = stream.frame().await {
        let frame = match frame {
            Ok(frame) => frame,
            Err(_) => {
                // Peer disconnected mid-upload; the guard removes the temp file.
                return with_cors(internal_error(std::io::Error::new(
                    std::io::ErrorKind::ConnectionAborted,
                    "peer disconnected mid-upload",
                )));
            }
        };
        let Ok(bytes) = frame.into_data() else {
            continue; // trailer frame — nothing to persist
        };
        if let Err(e) = writer.write_all(&bytes).await {
            return internal_error(e);
        }
    }
    if let Err(e) = writer.flush().await {
        return internal_error(e);
    }
    drop(writer); // release the handle before renaming (Windows)
    match tokio::fs::rename(&part_path, &full).await {
        Ok(()) => {
            guard.disarm();
            with_cors(StatusCode::NO_CONTENT.into_response())
        }
        Err(e) => internal_error(e),
    }
}

async fn delete_path(
    State(state): State<Arc<ServerState>>,
    AxumPath(path): AxumPath<String>,
) -> Response {
    let Some(full) = safe_join(&state.root, &path) else {
        return bad_request("invalid path");
    };
    // Missing is success: deleteDir's contract is idempotence.
    let result = match tokio::fs::metadata(&full).await {
        Ok(meta) if meta.is_dir() => tokio::fs::remove_dir_all(&full).await,
        Ok(_) => tokio::fs::remove_file(&full).await,
        Err(_) => Ok(()),
    };
    match result {
        Ok(()) => with_cors(StatusCode::NO_CONTENT.into_response()),
        Err(e) => internal_error(e),
    }
}

#[derive(Deserialize)]
struct ListRequest {
    dir: String,
}

async fn list_dir(
    State(state): State<Arc<ServerState>>,
    Json(req): Json<ListRequest>,
) -> Response {
    let dir = if req.dir.starts_with('/') {
        req.dir
    } else {
        format!("/{}", req.dir)
    };
    let Some(full) = safe_join(&state.root, &dir) else {
        return bad_request("invalid path");
    };
    let mut entries = Vec::new();
    let mut reader = match tokio::fs::read_dir(&full).await {
        Ok(reader) => reader,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return with_cors(Json(json!({ "entries": entries })).into_response());
        }
        Err(e) => return internal_error(e),
    };
    while let Ok(Some(entry)) = reader.next_entry().await {
        let Ok(meta) = entry.metadata().await else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().to_string();
        let child_path = format!("{}/{}", dir.trim_end_matches('/'), name);
        let (is_dir, size) = if meta.is_dir() {
            (true, None)
        } else {
            (false, Some(meta.len()))
        };
        entries.push(json!({
            "name": name,
            "path": child_path,
            "isDirectory": is_dir,
            "size": size,
        }));
    }
    with_cors(Json(json!({ "entries": entries })).into_response())
}
