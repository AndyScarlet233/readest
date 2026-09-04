import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialLocalSendState, useLocalSendStore } from '@/store/localsendStore';
import type { LocalSendStatus, SendFileInput } from '@/services/localsend/types';

vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => (s: string) => s }));
vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ appService: { isAndroidApp: false, isIOSApp: false } }),
}));
vi.mock('@/store/themeStore', () => ({
  useThemeStore: () => ({ safeAreaInsets: { bottom: 0 } }),
}));
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setRequestedPanel: vi.fn(),
      setRequestedSubPage: vi.fn(),
      setSettingsDialogOpen: vi.fn(),
    }),
  },
}));
vi.mock('@/services/localsend/pairedDevices', () => ({ isPairedDevice: () => false }));
vi.mock('@/services/localsend/preview', () => ({ previewDataUrl: () => null }));

const cancelLocalSendSend = vi.fn(async () => {});
vi.mock('@/services/localsend/service', () => ({
  announceLocalSend: vi.fn(async () => {}),
  cancelLocalSendSend: () => cancelLocalSendSend(),
  listLocalSendDevices: vi.fn(async () => []),
  sendLocalSendFiles: vi.fn(async () => {}),
}));

import DevicePickerDialog from '@/components/localsend/DevicePickerDialog';

const runningStatus: LocalSendStatus = {
  running: true,
  alias: 'This Device',
  port: 53318,
  fingerprint: 'self',
  deviceModel: 'Windows',
  localIps: ['192.168.1.10'],
  multicastError: null,
};
const files: SendFileInput[] = [
  { path: '/tmp/book.epub', fileName: 'book.epub', mimeType: 'application/epub+zip' },
];

beforeEach(() => {
  vi.clearAllMocks();
  useLocalSendStore.setState(initialLocalSendState);
  useLocalSendStore.getState().setStatus(runningStatus);
  useLocalSendStore.getState().startSend('Peer', 'peer-fp');
});
afterEach(() => cleanup());

describe('DevicePickerDialog send lifecycle', () => {
  it('keeps Cancel available if the service reports stopped mid-send', async () => {
    render(<DevicePickerDialog files={files} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    await act(async () => {
      useLocalSendStore.getState().setStatus({ ...runningStatus, running: false });
    });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByText('Enable Nearby BookDrop in Settings to send books.')).toBeNull();
  });
});
