// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Upload files from disk to a remote server over HTTP.
//!
//! Download files from a remote HTTP server to disk.

use futures_util::TryStreamExt;
use serde::{ser::Serializer, Serialize};
use tauri::{command, ipc::Channel, AppHandle};
use tauri_plugin_fs::FsExt;
use tokio::{
    fs::File,
    io::{AsyncWriteExt, BufWriter},
};
use tokio_util::codec::{BytesCodec, FramedRead};

use std::time::Instant;
use std::{collections::HashMap, sync::Arc};

type Result<T> = std::result::Result<T, Error>;

// Small uploads are more reliable as one native reqwest body than as a wrapped
// async file stream on Android/Windows WebViews. Keep large books streaming so
// a PDF cannot force tens or hundreds of MiB into memory at once.
const BUFFERED_UPLOAD_MAX_BYTES: u64 = 32 * 1024 * 1024;

fn should_buffer_upload(file_len: u64) -> bool {
    file_len <= BUFFERED_UPLOAD_MAX_BYTES
}

// The TransferStats struct tracks both transfer speed and cumulative transfer progress.
pub struct TransferStats {
    accumulated_chunk_len: usize, // Total length of chunks transferred in the current period
    accumulated_time: u128,       // Total time taken for the transfers in the current period
    pub transfer_speed: u64,      // Calculated transfer speed in bytes per second
    pub total_transferred: u64,   // Cumulative total of all transferred data
    start_time: Instant,          // Time when the current period started
    granularity: u32, // Time period (in milliseconds) over which the transfer speed is calculated
}

impl TransferStats {
    // Initializes a new TransferStats instance with the specified granularity.
    pub fn start(granularity: u32) -> Self {
        Self {
            accumulated_chunk_len: 0,
            accumulated_time: 0,
            transfer_speed: 0,
            total_transferred: 0,
            start_time: Instant::now(),
            granularity,
        }
    }
    // Records the transfer of a data chunk and updates both transfer speed and total progress.
    pub fn record_chunk_transfer(&mut self, chunk_len: usize) {
        let now = Instant::now();
        let it_took = now.duration_since(self.start_time).as_millis();
        self.accumulated_chunk_len += chunk_len;
        self.total_transferred += chunk_len as u64;
        self.accumulated_time += it_took;

        // Calculate transfer speed if accumulated time exceeds granularity.
        if self.accumulated_time >= self.granularity as u128 {
            self.transfer_speed =
                (self.accumulated_chunk_len as u128 / self.accumulated_time * 1024) as u64;
            self.accumulated_chunk_len = 0;
            self.accumulated_time = 0;
        }

        // Reset the start time for the next period.
        self.start_time = now;
    }
}

// Provides a default implementation for TransferStats with a granularity of 500 milliseconds.
impl Default for TransferStats {
    fn default() -> Self {
        Self::start(500) // Default granularity is 500 ms
    }
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Request(#[from] reqwest::Error),
    #[error("{0}")]
    ContentLength(String),
    #[error("request failed with status code {0}: {1}")]
    HttpErrorCode(u16, String),
    #[error("permission denied: path not in filesystem scope: {0}")]
    Forbidden(String),
}

/// Reject paths the webview must not be allowed to target: relative paths and
/// any `..` parent-directory traversal. `fs_scope().is_allowed` is a glob match,
/// so a `..` segment could otherwise escape an allowed prefix.
fn has_disallowed_components(file_path: &str) -> bool {
    let path = std::path::Path::new(file_path);
    !path.is_absolute()
        || path
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
}

/// The app's own storage always carries either the `Readest` data folder or the
/// app's bundle identifier in its path — the Android sandbox
/// (`/data/user/0/<identifier>/…`, including the cache dir) and the desktop
/// identifier dirs (`…/<identifier>/…`). Those paths aren't in the global
/// `fs_scope()` (their capability patterns are command-scoped), so `is_allowed`
/// returns false for the app's own files. Accept these segments as a fallback,
/// the way `dir_scanner::read_dir` does. `..` is already rejected, so foreign
/// targets (e.g. `~/.ssh/id_rsa`) stay blocked.
fn is_within_app_storage(file_path: &str, app_identifier: &str) -> bool {
    file_path.contains("Readest") || file_path.contains(app_identifier)
}

/// Validate a webview-supplied `file_path` before any `File::create`/`File::open`.
/// Without this, `download_file`/`upload_file` would write/read arbitrary local
/// paths (e.g. `~/.ssh/id_rsa`, autostart entries) from any JS running in the
/// privileged Tauri origin — see GHSA-55vr-pvq5-6fmg. We require an absolute,
/// traversal-free path that is either granted by the fs scope (persisted dialog
/// grants for custom/external roots) or lives inside the app's own storage.
pub(crate) fn ensure_path_allowed<R: tauri::Runtime>(
    app: &AppHandle<R>,
    file_path: &str,
) -> std::result::Result<(), Error> {
    if has_disallowed_components(file_path) {
        return Err(Error::Forbidden(file_path.to_string()));
    }
    if app.fs_scope().is_allowed(std::path::Path::new(file_path))
        || is_within_app_storage(file_path, &app.config().identifier)
    {
        return Ok(());
    }
    Err(Error::Forbidden(file_path.to_string()))
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    progress: u64,
    total: u64,
    transfer_speed: u64,
}

#[command]
#[allow(clippy::too_many_arguments)] // Tauri command surface mirrors the JS caller's options.
pub async fn download_file<R: tauri::Runtime>(
    app: AppHandle<R>,
    url: &str,
    file_path: &str,
    headers: HashMap<String, String>,
    body: Option<String>,
    single_threaded: Option<bool>,
    skip_ssl_verification: Option<bool>,
    on_progress: Channel<ProgressPayload>,
) -> Result<HashMap<String, String>> {
    use futures::stream::{self, StreamExt};
    use std::cmp::min;
    use tokio::io::AsyncSeekExt;

    ensure_path_allowed(&app, file_path)?;

    const PART_SIZE: u64 = 1024 * 1024;

    let client = reqwest::ClientBuilder::new()
        .danger_accept_invalid_certs(skip_ssl_verification.unwrap_or(false))
        .danger_accept_invalid_hostnames(skip_ssl_verification.unwrap_or(false))
        .build()?;
    let force_single = single_threaded.unwrap_or(false);

    async fn single_threaded_download(
        client: &reqwest::Client,
        url: &str,
        file_path: &str,
        headers: &HashMap<String, String>,
        body: &Option<String>,
        on_progress: Channel<ProgressPayload>,
    ) -> Result<HashMap<String, String>> {
        let mut request = if let Some(body) = body {
            client.post(url).body(body.clone())
        } else {
            client.get(url)
        };

        for (key, value) in headers {
            request = request.header(key, value);
        }

        let response = request.send().await?;
        if !response.status().is_success() {
            return Err(Error::HttpErrorCode(
                response.status().as_u16(),
                response.text().await.unwrap_or_default(),
            ));
        }

        let mut resp_headers = HashMap::new();
        for (key, value) in response.headers().iter() {
            if let Ok(val_str) = value.to_str() {
                resp_headers.insert(key.to_string(), val_str.to_string());
            }
        }

        let total = response.content_length().unwrap_or(0);
        let mut file = BufWriter::new(File::create(file_path).await?);
        let mut stream = response.bytes_stream();

        let mut stats = TransferStats::default();
        while let Some(chunk) = stream.try_next().await? {
            file.write_all(&chunk).await?;
            stats.record_chunk_transfer(chunk.len());
            let _ = on_progress.send(ProgressPayload {
                progress: stats.total_transferred,
                total,
                transfer_speed: stats.transfer_speed,
            });
        }
        file.flush().await?;

        Ok(resp_headers)
    }

    if force_single {
        return single_threaded_download(&client, url, file_path, &headers, &body, on_progress)
            .await;
    }

    // Check if server supports range requests
    let mut range_req = client.get(url).header("Range", "bytes=0-0");
    for (key, value) in headers.iter() {
        range_req = range_req.header(key, value);
    }
    let range_resp = range_req.send().await?;
    let accept_ranges = range_resp
        .headers()
        .get("accept-ranges")
        .map(|v| v.to_str().unwrap_or(""))
        .unwrap_or("")
        .eq_ignore_ascii_case("bytes");
    let total = range_resp
        .headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split('/').nth(1))
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let mut resp_headers = HashMap::new();
    for (key, value) in range_resp.headers().iter() {
        if let Ok(val_str) = value.to_str() {
            resp_headers.insert(key.to_string(), val_str.to_string());
        }
    }

    if !accept_ranges || total == 0 {
        return single_threaded_download(&client, url, file_path, &headers, &body, on_progress)
            .await;
    }

    // Multi-part download with range access
    let part_count = total.div_ceil(PART_SIZE);
    let file = File::create(file_path).await?;
    file.set_len(total).await?;

    let file = Arc::new(tokio::sync::Mutex::new(file));
    let progress = Arc::new(tokio::sync::Mutex::new(TransferStats::default()));

    stream::iter(0..part_count)
        .for_each_concurrent(8, |i| {
            let client = client.clone();
            let file = Arc::clone(&file);
            let progress = Arc::clone(&progress);
            let headers = headers.clone();
            let url = url.to_string();
            let on_progress = on_progress.clone();

            async move {
                let start = i * PART_SIZE;
                let end = min(start + PART_SIZE - 1, total - 1);
                let range_header = format!("bytes={start}-{end}");

                let mut req = client.get(&url).header("Range", range_header);
                for (key, value) in headers {
                    req = req.header(key, value);
                }

                let resp = match req.send().await {
                    Ok(r) => r,
                    Err(_) => return,
                };

                if !resp.status().is_success()
                    && resp.status() != reqwest::StatusCode::PARTIAL_CONTENT
                {
                    return;
                }

                let bytes = match resp.bytes().await {
                    Ok(b) => b,
                    Err(_) => return,
                };

                {
                    let mut f = file.lock().await;
                    f.seek(std::io::SeekFrom::Start(start)).await.unwrap();
                    f.write_all(&bytes).await.unwrap();
                }

                {
                    let mut stat = progress.lock().await;
                    stat.record_chunk_transfer(bytes.len());
                    let _ = on_progress.send(ProgressPayload {
                        progress: stat.total_transferred,
                        total,
                        transfer_speed: stat.transfer_speed,
                    });
                }
            }
        })
        .await;

    Ok(resp_headers)
}

#[command]
pub async fn upload_file<R: tauri::Runtime>(
    app: AppHandle<R>,
    url: &str,
    file_path: &str,
    method: &str,
    headers: HashMap<String, String>,
    on_progress: Channel<ProgressPayload>,
) -> Result<String> {
    ensure_path_allowed(&app, file_path)?;

    let file_len = tokio::fs::metadata(file_path).await?.len();
    let buffered = should_buffer_upload(file_len);
    let started_at = Instant::now();

    let client = reqwest::Client::new();
    let mut request = match method.to_uppercase().as_str() {
        "POST" => client.post(url),
        "PUT" => client.put(url),
        _ => return Err(Error::ContentLength("Invalid HTTP method".into())),
    };

    let body = if buffered {
        reqwest::Body::from(tokio::fs::read(file_path).await?)
    } else {
        let file = File::open(file_path).await?;
        file_to_body(on_progress.clone(), file, file_len)
    };

    request = request
        .header(reqwest::header::CONTENT_LENGTH, file_len)
        .body(body);

    for (key, value) in headers {
        request = request.header(&key, value);
    }

    let response = request.send().await?;
    if response.status().is_success() {
        if buffered {
            let elapsed = started_at.elapsed().as_secs_f64();
            let transfer_speed = if elapsed > 0.0 {
                (file_len as f64 / elapsed) as u64
            } else {
                file_len
            };
            let _ = on_progress.send(ProgressPayload {
                progress: file_len,
                total: file_len,
                transfer_speed,
            });
        }
        response.text().await.map_err(Into::into)
    } else {
        Err(Error::HttpErrorCode(
            response.status().as_u16(),
            response.text().await.unwrap_or_default(),
        ))
    }
}

fn file_to_body(channel: Channel<ProgressPayload>, file: File, file_len: u64) -> reqwest::Body {
    let mut stats = TransferStats::default();
    let stream = FramedRead::new(file, BytesCodec::new()).map_ok(move |chunk| {
        let bytes = chunk.freeze();
        stats.record_chunk_transfer(bytes.len());
        let _ = channel.send(ProgressPayload {
            progress: stats.total_transferred,
            total: file_len,
            transfer_speed: stats.transfer_speed,
        });
        bytes
    });
    reqwest::Body::wrap_stream(stream)
}

/// Publish `source` over `destination` atomically on Windows: ReplaceFileW
/// avoids the delete-then-rename gap of `std::fs::rename` for an existing
/// destination. Falls back to MoveFileExW when the destination does not exist
/// yet (first write to a fresh path).
#[cfg(windows)]
pub(crate) fn replace_file_atomically(
    source: &std::path::Path,
    destination: &std::path::Path,
) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, ReplaceFileW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let to_wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<u16>>()
    };
    let source = to_wide(source);
    let destination = to_wide(destination);

    let replaced = unsafe {
        ReplaceFileW(
            destination.as_ptr(),
            source.as_ptr(),
            std::ptr::null(),
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if replaced != 0 {
        return Ok(());
    }

    // The first write has no destination yet. MoveFileExW is atomic on the
    // same volume and also handles a destination created in the small race.
    let error = std::io::Error::last_os_error();
    if error.kind() != std::io::ErrorKind::NotFound {
        return Err(error);
    }
    let moved = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved != 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        has_disallowed_components, is_within_app_storage, should_buffer_upload,
        BUFFERED_UPLOAD_MAX_BYTES,
    };

    #[test]
    fn small_uploads_use_buffered_native_body() {
        assert!(should_buffer_upload(742 * 1024));
        assert!(should_buffer_upload(BUFFERED_UPLOAD_MAX_BYTES));
        assert!(!should_buffer_upload(BUFFERED_UPLOAD_MAX_BYTES + 1));
    }

    #[test]
    fn app_storage_fallback_accepts_app_paths() {
        let id = "com.bilingify.readest";
        // Covers, dictionaries, books, gloss packs — under the `Readest` data dir.
        assert!(is_within_app_storage(
            "/data/user/0/com.bilingify.readest/Readest/Books/abc/cover.png",
            id
        ));
        assert!(is_within_app_storage(
            "/data/user/0/com.bilingify.readest/Readest/Dictionaries/x/d.mdx",
            id
        ));
        // Cache-dir downloads (e.g. OPDS) carry no `Readest` segment but are still
        // inside the app sandbox, matched via the bundle identifier.
        assert!(is_within_app_storage(
            "/data/user/0/com.bilingify.readest/cache/opds-book.epub",
            id
        ));
        // Foreign targets carry neither segment and stay blocked.
        assert!(!is_within_app_storage("/home/user/.ssh/id_rsa", id));
        assert!(!is_within_app_storage("/etc/passwd", id));
    }

    #[test]
    fn rejects_relative_and_traversal_paths() {
        // Relative paths can't be reasoned about against an absolute scope.
        assert!(has_disallowed_components("relative/file.epub"));
        assert!(has_disallowed_components("file.epub"));
        // `..` traversal, whether the path is relative or absolute.
        assert!(has_disallowed_components("foo/../bar"));
        assert!(has_disallowed_components(
            "/home/user/Readest/../../.ssh/id_rsa"
        ));
    }

    #[cfg(unix)]
    #[test]
    fn accepts_plain_absolute_paths() {
        assert!(!has_disallowed_components(
            "/Users/x/Library/Caches/app/book.epub"
        ));
        assert!(!has_disallowed_components("/Users/x/Readest/Books/h.epub"));
    }

    #[cfg(windows)]
    #[test]
    fn accepts_plain_absolute_paths_windows() {
        assert!(!has_disallowed_components(
            "C:\\Users\\x\\AppData\\Roaming\\Readest\\Books\\h.epub"
        ));
    }
}