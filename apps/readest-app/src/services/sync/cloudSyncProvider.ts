import type { SystemSettings } from '@/types/settings';
import type { UserPlan } from '@/types/quota';
import { isCloudSyncAllowed } from '@/utils/access';
import type { FileSyncBackendKind } from '@/services/sync/file/providerRegistry';

/**
 * The cloud sync provider kind for library data (book files, book rows,
 * progress, notes). 'readest' is the native Readest Cloud; the others are
 * the third-party file-sync backends.
 *
 * Providers are INDEPENDENT (#5062): any subset may sync the library at once,
 * including none. Readest Cloud's flag has a derived default so an absent value
 * reproduces the old exclusive behaviour; every third-party backend is a plain
 * per-device `enabled` flag. Account-level data (settings replicas, reading
 * stats, dictionaries/fonts, translations) always syncs via Readest Cloud while
 * signed in, regardless of this selection.
 */
export type CloudSyncProviderKind = 'readest' | FileSyncBackendKind;

/** Settings slice key for a third-party backend kind. */
export const settingsKeyForBackend = (
  kind: FileSyncBackendKind,
): 'webdav' | 'googleDrive' | 's3' | 'onedrive' | 'icloud' | 'lan' =>
  kind === 'gdrive' ? 'googleDrive' : kind;

/** Human-readable provider name (product names — deliberately untranslated). */
export const cloudProviderDisplayName = (kind: CloudSyncProviderKind): string =>
  kind === 'gdrive'
    ? 'Google Drive'
    : kind === 'webdav'
      ? 'WebDAV'
      : kind === 's3'
        ? 'S3'
        : kind === 'onedrive'
          ? 'OneDrive'
          : kind === 'icloud'
            ? 'iCloud'
            : kind === 'lan'
              ? 'LAN'
              : 'Readest Cloud';

/**
 * The third-party backends the user has switched on, in a STABLE order that
 * every loop, list, and sync pass in the app relies on.
 */
export const getEnabledFileSyncBackends = (
  settings: SystemSettings | null | undefined,
): FileSyncBackendKind[] => {
  const enabled: FileSyncBackendKind[] = [];
  if (settings?.webdav?.enabled) enabled.push('webdav');
  if (settings?.googleDrive?.enabled) enabled.push('gdrive');
  if (settings?.s3?.enabled) enabled.push('s3');
  if (settings?.onedrive?.enabled) enabled.push('onedrive');
  if (settings?.icloud?.enabled) enabled.push('icloud');
  // LAN last: the fork's home-network backend — local peers, no cloud plan.
  if (settings?.lan?.enabled) enabled.push('lan');
  return enabled;
};

/** Any third-party cloud backend switched on. LAN is intentionally excluded. */
export const hasAnyThirdPartyEnabled = (settings: SystemSettings | null | undefined): boolean =>
  getEnabledFileSyncBackends(settings).some((kind) => kind !== 'lan');

/**
 * Whether Readest Cloud syncs the library channels on this device.
 * An absent flag keeps the pre-#5062 derived behaviour.
 */
export const isReadestCloudEnabled = (settings: SystemSettings | null | undefined): boolean =>
  settings?.readestCloud?.enabled ?? !hasAnyThirdPartyEnabled(settings);

/** Every provider syncing the library on this device, Readest Cloud first. */
export const getCloudSyncProviders = (
  settings: SystemSettings | null | undefined,
): CloudSyncProviderKind[] => [
  ...(isReadestCloudEnabled(settings) ? (['readest'] as const) : []),
  ...getEnabledFileSyncBackends(settings),
];

export const cloudProvidersDisplayName = (kinds: CloudSyncProviderKind[]): string =>
  kinds.map(cloudProviderDisplayName).join(', ');

let cachedUserPlan: UserPlan = 'free';

export const setCachedUserPlan = (plan: UserPlan | undefined): void => {
  cachedUserPlan = plan ?? 'free';
};

export const getCachedUserPlan = (): UserPlan => cachedUserPlan;

/**
 * Cached alongside the plan because upstream premium access now also honors an
 * outright Full Customization purchase. Defaults to the restrictive side.
 */
let cachedCustomizationPurchased = false;

export const setCachedCustomizationPurchased = (purchased: boolean | undefined): void => {
  cachedCustomizationPurchased = purchased ?? false;
};

export const getCachedCustomizationPurchased = (): boolean => cachedCustomizationPurchased;

export interface CloudSyncGate {
  readest: boolean;
  backends: FileSyncBackendKind[];
  /** Cloud backends are paused by the entitlement gate; LAN never is. */
  paused: boolean;
}

export const resolveCloudSyncGate = (
  settings: SystemSettings | null | undefined,
  plan: UserPlan = cachedUserPlan,
  customizationPurchased: boolean = cachedCustomizationPurchased,
): CloudSyncGate => {
  const backends = getEnabledFileSyncBackends(settings);
  const cloudBackends = backends.filter((kind) => kind !== 'lan');
  return {
    readest: isReadestCloudEnabled(settings),
    backends,
    // LAN sits outside the account plan/quota and therefore never pauses.
    paused:
      cloudBackends.length > 0 && !isCloudSyncAllowed(plan, customizationPurchased),
  };
};

/** The backends that may actually run right now. LAN survives a cloud pause. */
export const getActiveFileSyncBackends = (
  settings: SystemSettings | null | undefined,
  plan?: UserPlan,
): FileSyncBackendKind[] => {
  const gate = resolveCloudSyncGate(settings, plan);
  return gate.paused ? gate.backends.filter((kind) => kind === 'lan') : gate.backends;
};

/**
 * One-time upgrade migration helper: flip syncBooks on for every enabled
 * backend so a newly selected provider does not silently omit book binaries.
 */
export const applySyncBooksAutoEnable = (settings: SystemSettings): boolean => {
  let changed = false;
  for (const kind of getEnabledFileSyncBackends(settings)) {
    switch (kind) {
      case 'webdav':
        if (settings.webdav && !settings.webdav.syncBooks) {
          settings.webdav = { ...settings.webdav, syncBooks: true };
          changed = true;
        }
        break;
      case 'gdrive':
        if (settings.googleDrive && !settings.googleDrive.syncBooks) {
          settings.googleDrive = { ...settings.googleDrive, syncBooks: true };
          changed = true;
        }
        break;
      case 's3':
        if (settings.s3 && !settings.s3.syncBooks) {
          settings.s3 = { ...settings.s3, syncBooks: true };
          changed = true;
        }
        break;
      case 'onedrive':
        if (settings.onedrive && !settings.onedrive.syncBooks) {
          settings.onedrive = { ...settings.onedrive, syncBooks: true };
          changed = true;
        }
        break;
      case 'icloud':
        if (settings.icloud && !settings.icloud.syncBooks) {
          settings.icloud = { ...settings.icloud, syncBooks: true };
          changed = true;
        }
        break;
      case 'lan':
        if (settings.lan && !settings.lan.syncBooks) {
          settings.lan = { ...settings.lan, syncBooks: true };
          changed = true;
        }
        break;
    }
  }
  return changed;
};

export const isReadestCloudStorageActive = (
  settings: SystemSettings | null | undefined,
  _plan?: UserPlan,
): boolean => isReadestCloudEnabled(settings);
