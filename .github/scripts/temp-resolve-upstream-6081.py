import json
from pathlib import Path

path = Path('apps/readest-app/package.json')
data = json.loads(path.read_text())
deps = data['dependencies']

updates = {
    '@tauri-apps/plugin-biometric': ('^2.3.2', '^2.3.3'),
    '@tauri-apps/plugin-clipboard-manager': ('^2.3.0', '^2.3.3'),
    '@tauri-apps/plugin-deep-link': ('^2.4.7', '^2.4.10'),
    '@tauri-apps/plugin-dialog': ('^2.6.0', '^2.7.3'),
    '@tauri-apps/plugin-fs': ('^2.4.5', '^2.5.2'),
    '@tauri-apps/plugin-haptics': ('^2.3.2', '^2.3.3'),
    '@tauri-apps/plugin-http': ('^2.5.7', '^2.6.0'),
    '@tauri-apps/plugin-log': ('^2.8.0', '^2.9.1'),
    '@tauri-apps/plugin-opener': ('^2.5.3', '^2.5.5'),
    '@tauri-apps/plugin-shell': ('~2.3.5', '~2.3.6'),
    '@tauri-apps/plugin-updater': ('^2.10.0', '^2.11.0'),
    '@tauri-apps/plugin-websocket': ('~2.4.2', '~2.4.3'),
}

for name, (old, new) in updates.items():
    actual = deps.get(name)
    if actual != old:
        raise SystemExit(f'unexpected {name} version while resolving #6081: {actual!r}, expected {old!r}')
    deps[name] = new

if deps.get('@tauri-apps/plugin-barcode-scanner') != '^2.4.5':
    raise SystemExit('fork barcode-scanner dependency disappeared during #6081 merge')

path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
