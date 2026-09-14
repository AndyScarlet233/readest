/**
 * LAN peer transport for the file-sync engine: talks to the axum server
 * embedded in the peer's Readest app (src-tauri/src/lan_sync). Both devices
 * run the same server, so the "remote" tree this provider sees is the peer's
 * `<app_data>/LanSync` directory, already laid out in the frozen wire format
 * of `layout.ts` — which is why this stays thin: no per-backend path/id
 * resolution (unlike Drive), the URL is the path.
 *
 * Transport: on Tauri platforms requests go through the plugin-http Rust
 * bridge (the KOSync client's approach), so webview CORS and Android's
 * cleartext policy don't apply. The peer server still answers CORS so web
 * fallbacks keep working.
 */
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriAppPlatform } from '@/services/environment';
import { tauriDownload, tauriUpload } from '@/utils/transfer';
import {
  FileSyncError,
  type FileEntry,
  type FileHead,
  type FileSyncProvider,
} from '@/services/sync/file/provider';
import { LAN_SYNC_PROTOCOL } from '@/services/lanSync/pairing';
import type { LanSyncSettings } from '@/types/settings';

const peerBase = (settings: LanSyncSettings): string => {
  const host = settings.host
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  if (!host) {
    throw new FileSyncError('LAN sync: peer host is not configured', 'UNKNOWN');
  }
  return host.includes(':') ? `http://${host}` : `http://${host}:${settings.port}`;
};

export const buildLanSyncAuthHeaders = (token?: string): Record<string, string> => {
  const normalized = token?.trim() ?? '';
  return normalized ? { Authorization: `Bearer ${normalized}` } : {};
};

const getLanStreamAuthError = (error: unknown, action: string): FileSyncError | null => {
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/status code\s*:?\s*(\d{3})\b/i)?.[1];
  const statusCode = status ? Number(status) : undefined;
  if (statusCode !== 401 && statusCode !== 403) return null;
  return new FileSyncError(
    `LAN peer rejected the pairing token (${action})`,
    'AUTH_FAILED',
    statusCode,
  );
};

/**
 * Native LAN book transfers must not fail open into the engine's buffered
 * compatibility path. That path materialises a whole book in the WebView and
 * is useful for cloud-provider compatibility, but LAN already owns a reliable
 * disk-to-socket native path and should keep large books out of JS memory.
 */
export const toLanStreamError = (error: unknown, action: 'upload' | 'download'): FileSyncError => {
  const authError = getLanStreamAuthError(error, action);
  if (authError) return authError;
  const message = error instanceof Error ? error.message : String(error);
  return new FileSyncError(`LAN peer ${action} stream failed: ${message}`, 'NETWORK');
};

const doFetch = async (
  settings: LanSyncSettings,
  path: string,
  init?: { method?: string; body?: BodyInit; contentType?: string },
): Promise<Response> => {
  const headers: Record<string, string> = buildLanSyncAuthHeaders(settings.token);
  if (init?.body !== undefined) {
    headers['Content-Type'] =
      init.contentType ??
      (typeof init.body === 'string' ? 'text/plain; charset=utf-8' : 'application/octet-stream');
  }
  const fetcher = isTauriAppPlatform() ? tauriFetch : window.fetch.bind(window);
  try {
    return await fetcher(`${peerBase(settings)}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body,
    });
  } catch (err) {
    throw new FileSyncError(
      `LAN peer unreachable (${settings.host}:${settings.port}): ${
        err instanceof Error ? err.message : String(err)
      }`,
      'NETWORK',
    );
  }
};

const mapStatus = (res: Response, action: string): void => {
  if (res.status === 401 || res.status === 403) {
    throw new FileSyncError(
      `LAN peer rejected the pairing token (${action})`,
      'AUTH_FAILED',
      res.status,
    );
  }
  if (!res.ok) {
    throw new FileSyncError(`LAN peer error ${res.status} (${action})`, 'UNKNOWN', res.status);
  }
};

/** Request a /files path; resolves null on 404 per the provider contract. */
const fileRequest = async (
  settings: LanSyncSettings,
  path: string,
  init?: { method?: string; body?: BodyInit },
): Promise<Response | null> => {
  const res = await doFetch(settings, `/files${path}`, init);
  if (res.status === 404) return null;
  mapStatus(res, `${init?.method ?? 'GET'} ${path}`);
  return res;
};

/** Probe a peer before persisting a connection. */
export const lanSyncPing = async (
  settings: LanSyncSettings,
): Promise<{ name: string; device_id: string; protocol: string }> => {
  const res = await doFetch(settings, '/ping');
  mapStatus(res, 'ping');
  const value: unknown = await res.json();
  if (!value || typeof value !== 'object') {
    throw new FileSyncError('LAN peer is not a compatible Readest server', 'UNKNOWN', res.status);
  }
  const peer = value as Record<string, unknown>;
  const protocol = peer['protocol'];
  const name = peer['name'];
  const deviceId = peer['device_id'];
  if (protocol !== LAN_SYNC_PROTOCOL || typeof name !== 'string' || typeof deviceId !== 'string') {
    throw new FileSyncError('LAN peer is not a compatible Readest server', 'UNKNOWN', res.status);
  }
  return { name, device_id: deviceId, protocol };
};

export const createLanSyncProvider = (settings: LanSyncSettings): FileSyncProvider => {
  const native = isTauriAppPlatform();
  const provider: FileSyncProvider = {
    rootPath: '/',

    readText: async (path) => {
      const res = await fileRequest(settings, path, { method: 'GET' });
      return res ? res.text() : null;
    },

    readBinary: async (path) => {
      const res = await fileRequest(settings, path, { method: 'GET' });
      return res ? res.arrayBuffer() : null;
    },

    head: async (path) => {
      const res = await fileRequest(settings, path, { method: 'HEAD' });
      if (!res) return null;
      const sizeHeader = Number(res.headers.get('content-length') ?? '');
      const head: FileHead = {
        size: Number.isFinite(sizeHeader) && sizeHeader > 0 ? sizeHeader : undefined,
        etag: res.headers.get('etag') ?? undefined,
      };
      return head;
    },

    list: async (path) => {
      const res = await doFetch(settings, '/list', {
        method: 'POST',
        body: JSON.stringify({ dir: path }),
        contentType: 'application/json',
      });
      mapStatus(res, `list ${path}`);
      const data = (await res.json()) as {
        entries?: Array<Pick<FileEntry, 'name' | 'path' | 'isDirectory' | 'size' | 'lastModified'>>;
      };
      return (data.entries ?? []).map((entry) => ({
        name: entry.name,
        path: entry.path,
        isDirectory: !!entry.isDirectory,
        size: entry.size,
        lastModified: entry.lastModified,
      }));
    },

    writeText: async (path, body) => {
      const res = await fileRequest(settings, path, { method: 'PUT', body });
      if (!res) {
        throw new FileSyncError(`LAN peer file was not found for PUT ${path}`, 'NOT_FOUND', 404);
      }
    },

    writeBinary: async (path, body) => {
      const res = await fileRequest(settings, path, { method: 'PUT', body });
      if (!res) {
        throw new FileSyncError(`LAN peer file was not found for PUT ${path}`, 'NOT_FOUND', 404);
      }
    },

    ensureDir: async () => {
      // The peer creates parent directories on every PUT.
    },

    deleteDir: async (path) => {
      await fileRequest(settings, path, { method: 'DELETE' });
    },
  };

  // Keep LAN binary transfers entirely in the native layer. We deliberately do
  // not add LAN-only fields to FileSyncProvider: this provider expresses its
  // requirements through the existing uploadStream/downloadStream seam, so
  // future upstream engine changes have far fewer merge points.
  if (native) {
    const authHeaders = (): Record<string, string> => buildLanSyncAuthHeaders(settings.token);
    const fileUrl = (path: string): string => `${peerBase(settings)}/files${path}`;

    provider.uploadStream = async (remotePath, localPath) => {
      try {
        await tauriUpload(fileUrl(remotePath), localPath, 'PUT', undefined, authHeaders());
        return true;
      } catch (e) {
        console.warn('LanSyncProvider.uploadStream failed', remotePath, e);
        throw toLanStreamError(e, 'upload');
      }
    };

    provider.downloadStream = async (remotePath, localPath, onProgress) => {
      try {
        await tauriDownload(
          fileUrl(remotePath),
          localPath,
          onProgress,
          authHeaders(),
          undefined,
          true,
          false,
        );
        return true;
      } catch (e) {
        console.warn('LanSyncProvider.downloadStream failed', remotePath, e);
        throw toLanStreamError(e, 'download');
      }
    };
  }

  return provider;
};
