from pathlib import Path

path = Path('apps/readest-app/src-tauri/src/transfer_file.rs')
text = path.read_text()

replacements = [
    (
        'fn is_within_app_storage(app: &AppHandle, file_path: &str) -> bool {',
        'fn is_within_app_storage<R: tauri::Runtime>(app: &AppHandle<R>, file_path: &str) -> bool {',
    ),
    (
        'pub(crate) fn ensure_path_allowed(\n    app: &AppHandle,\n    file_path: &str,\n) -> std::result::Result<(), Error> {',
        'pub(crate) fn ensure_path_allowed<R: tauri::Runtime>(\n    app: &AppHandle<R>,\n    file_path: &str,\n) -> std::result::Result<(), Error> {',
    ),
    (
        'pub async fn download_file(\n    app: AppHandle,',
        'pub async fn download_file<R: tauri::Runtime>(\n    app: AppHandle<R>,',
    ),
    (
        'pub async fn upload_file(\n    app: AppHandle,',
        'pub async fn upload_file<R: tauri::Runtime>(\n    app: AppHandle<R>,',
    ),
]

for old, new in replacements:
    if text.count(old) != 1:
        raise SystemExit(f'unexpected #6074 transfer_file shape: {old!r} occurred {text.count(old)} times')
    text = text.replace(old, new, 1)

path.write_text(text)
