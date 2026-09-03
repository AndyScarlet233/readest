import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FoliateView } from '@/types/view';

const mocks = vi.hoisted(() => ({
  getBookData: vi.fn(),
  getViewSettings: vi.fn(),
  getViewState: vi.fn(),
  hoveredBookKey: null as string | null,
  setHoveredBookKey: vi.fn(),
}));

vi.mock('@/context/EnvContext', () => ({ useEnv: () => ({ appService: null }) }));
vi.mock('@/store/bookDataStore', () => ({
  useBookDataStore: () => ({ getBookData: mocks.getBookData }),
}));
vi.mock('@/store/readerStore', () => ({
  useReaderStore: Object.assign(
    () => ({
      getViewSettings: mocks.getViewSettings,
      getViewState: mocks.getViewState,
      hoveredBookKey: mocks.hoveredBookKey,
      setHoveredBookKey: mocks.setHoveredBookKey,
    }),
    { getState: () => ({ hoveredBookKey: mocks.hoveredBookKey }) },
  ),
}));
vi.mock('@/store/deviceStore', () => ({
  useDeviceControlStore: () => ({
    acquireVolumeKeyInterception: vi.fn(),
    releaseVolumeKeyInterception: vi.fn(),
    acquirePageTurnerKeyInterception: vi.fn(),
    releasePageTurnerKeyInterception: vi.fn(),
    ensureKeyForwarding: vi.fn(),
  }),
}));
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: Object.assign(() => undefined, { getState: () => ({ settings: {} }) }),
}));
vi.mock('@/store/sidebarStore', () => ({
  useSidebarStore: Object.assign(() => undefined, {
    getState: () => ({ sideBarBookKey: 'book-1' }),
  }),
}));
vi.mock('@/utils/bridge', () => ({ refreshEinkScreen: vi.fn() }));

import { usePagination } from '@/app/reader/hooks/usePagination';
import { handleClickCapture, handleDragstart } from '@/app/reader/utils/iframeEventHandlers';

const makeView = (x = true, y = true) => ({
  book: { rendition: { layout: 'pre-paginated' } },
  isFixedLayout: true,
  renderer: { scrolled: false },
  isOverflowX: () => x,
  isOverflowY: () => y,
  pan: vi.fn(),
  prev: vi.fn(),
  next: vi.fn(),
});

const point = (screenX: number, screenY: number, extra = {}) => ({
  type: 'iframe-mousedown' as const,
  bookKey: 'book-1',
  button: 0,
  screenX,
  screenY,
  hasTextSelection: false,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBookData.mockReturnValue({ isFixedLayout: true });
  mocks.getViewState.mockReturnValue({ inited: true });
  mocks.getViewSettings.mockReturnValue({ scrolled: false, zoomLevel: 150, zoomMode: 'fit-page' });
});
afterEach(() => cleanup());

describe('usePagination fixed-layout mouse pan', () => {
  test('claims after threshold and pans incrementally with opposite screen delta', () => {
    const view = makeView(true, false);
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );
    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        screenX: 103,
        screenY: 101,
      }),
    ).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        screenX: 120,
        screenY: 101,
      }),
    ).toBe(true);
    expect(view.pan).toHaveBeenCalledWith(-20, 0);
    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        screenX: 130,
        screenY: 101,
      }),
    ).toBe(true);
    expect(view.pan).toHaveBeenLastCalledWith(-10, 0);
    expect(
      h.result.current.handleMousePan({
        type: 'iframe-mouseup',
        bookKey: 'book-1',
        screenX: 130,
        screenY: 101,
      }),
    ).toBe(true);
  });

  test('preserves both deltas when a fixed-layout page overflows on both axes', () => {
    const view = makeView(true, true);
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );

    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 124,
        screenY: 118,
      }),
    ).toBe(true);
    expect(view.pan).toHaveBeenCalledWith(-24, -18);
  });

  test('keeps a fixed-layout drag alive until overflow becomes available', () => {
    let overflowX = false;
    const view = makeView(false, false);
    view.isOverflowX = () => overflowX;
    mocks.getViewSettings.mockReturnValue({
      scrolled: false,
      zoomLevel: 100,
      zoomMode: 'fit-page',
    });
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );

    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    overflowX = true;
    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 120,
        screenY: 100,
      }),
    ).toBe(true);
    expect(view.pan).toHaveBeenCalledWith(-20, 0);
  });

  test('turns a fit-page fixed-layout page after a horizontal mouse drag without overflow', () => {
    const view = makeView(false, false);
    mocks.getViewSettings.mockReturnValue({
      scrolled: false,
      zoomLevel: 100,
      zoomMode: 'fit-page',
      disableSwipe: false,
      rtl: false,
    });
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );

    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'iframe-mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 60,
        screenY: 102,
      }),
    ).toBe(true);
    expect(view.pan).not.toHaveBeenCalled();
    expect(
      h.result.current.handleMousePan({
        type: 'iframe-mouseup',
        bookKey: 'book-1',
        button: 0,
        screenX: 60,
        screenY: 102,
      }),
    ).toBe(true);
    expect(view.next).toHaveBeenCalledOnce();
    expect(view.prev).not.toHaveBeenCalled();
  });

  test('does not turn a zoomed no-overflow view as a page drag', () => {
    const view = makeView(false, false);
    mocks.getViewSettings.mockReturnValue({
      scrolled: false,
      zoomLevel: 150,
      zoomMode: 'fit-page',
      disableSwipe: false,
      rtl: false,
    });
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );

    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'iframe-mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 50,
        screenY: 100,
      }),
    ).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'iframe-mouseup',
        bookKey: 'book-1',
        button: 0,
        screenX: 50,
        screenY: 100,
      }),
    ).toBe(false);
    expect(view.pan).not.toHaveBeenCalled();
    expect(view.next).not.toHaveBeenCalled();
    expect(view.prev).not.toHaveBeenCalled();
  });

  test('cancels native image drag inside foliate-fxl only', () => {
    const preventDefault = vi.fn();
    const renderer = { localName: 'foliate-fxl', scrolled: false };
    const event = {
      target: { localName: 'img' },
      currentTarget: {
        defaultView: {
          frameElement: { getRootNode: () => ({ host: renderer }) },
        },
      },
      preventDefault,
    } as unknown as DragEvent;

    handleDragstart('book-1', event);
    expect(preventDefault).toHaveBeenCalledOnce();

    renderer.localName = 'foliate-paginator';
    handleDragstart('book-1', event);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  test('uses the live fixed-layout view when stored metadata lags', () => {
    const view = makeView();
    mocks.getBookData.mockReturnValue({ isFixedLayout: false });
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );

    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'iframe-mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 120,
        screenY: 100,
      }),
    ).toBe(true);
    expect(view.pan).toHaveBeenCalledWith(-20, 0);
  });

  test('does not double-pan an iframe move already handled by foliate-fxl', () => {
    const view = makeView();
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );

    h.result.current.handleMousePan(point(100, 100));
    expect(
      h.result.current.handleMousePan({
        type: 'iframe-mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 120,
        screenY: 100,
        rawPanHandled: true,
      }),
    ).toBe(true);
    expect(view.pan).not.toHaveBeenCalled();

    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 130,
        screenY: 100,
      }),
    ).toBe(true);
    expect(view.pan).toHaveBeenCalledWith(-10, 0);
  });

  test('ends a claimed drag when a move reports no buttons', () => {
    const view = makeView();
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );
    h.result.current.handleMousePan(point(100, 100));
    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 120,
        screenY: 100,
      }),
    ).toBe(true);

    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        buttons: 0,
        screenX: 140,
        screenY: 100,
      }),
    ).toBe(true);
    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        buttons: 1,
        screenX: 160,
        screenY: 100,
      }),
    ).toBe(false);
    expect(view.pan).toHaveBeenCalledOnce();
  });

  test('only an iframe primary-button release suppresses the compatibility click', () => {
    const view = makeView();
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );
    const click = () =>
      ({
        screenX: 120,
        screenY: 100,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn(),
      }) as unknown as MouseEvent;

    h.result.current.handleMousePan(point(100, 100));
    h.result.current.handleMousePan({
      type: 'mousemove',
      bookKey: 'book-1',
      buttons: 1,
      screenX: 120,
      screenY: 100,
    });
    h.result.current.handleMousePan({
      type: 'mouseup',
      bookKey: 'book-1',
      button: 0,
      screenX: 120,
      screenY: 100,
    });
    const outsideReleaseClick = click();
    handleClickCapture('book-1', outsideReleaseClick);
    expect(outsideReleaseClick.preventDefault).not.toHaveBeenCalled();

    h.result.current.handleMousePan(point(100, 100));
    h.result.current.handleMousePan({
      type: 'mousemove',
      bookKey: 'book-1',
      buttons: 1,
      screenX: 120,
      screenY: 100,
    });
    h.result.current.handleMousePan({
      type: 'mousemove',
      bookKey: 'book-1',
      buttons: 0,
      screenX: 125,
      screenY: 100,
    });
    const recoveryClick = click();
    handleClickCapture('book-1', recoveryClick);
    expect(recoveryClick.preventDefault).not.toHaveBeenCalled();

    h.result.current.handleMousePan(point(100, 100));
    h.result.current.handleMousePan({
      type: 'mousemove',
      bookKey: 'book-1',
      buttons: 1,
      screenX: 120,
      screenY: 100,
    });
    h.result.current.handleMousePan({
      type: 'iframe-mouseup',
      bookKey: 'book-1',
      button: 0,
      screenX: 120,
      screenY: 100,
    });
    const iframeReleaseClick = click();
    handleClickCapture('book-1', iframeReleaseClick);
    expect(iframeReleaseClick.preventDefault).toHaveBeenCalledOnce();
    expect(iframeReleaseClick.stopImmediatePropagation).toHaveBeenCalledOnce();
  });

  test('does not arm reflowable, scrolled, or non-overflowing views', () => {
    const view = makeView(false, false);
    view.isFixedLayout = false;
    view.book.rendition.layout = 'reflowable';
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );
    mocks.getBookData.mockReturnValue({ isFixedLayout: false });
    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    mocks.getBookData.mockReturnValue({ isFixedLayout: true });
    mocks.getViewSettings.mockReturnValue({ scrolled: true, zoomLevel: 150, zoomMode: 'fit-page' });
    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'mousemove',
        bookKey: 'book-1',
        screenX: 130,
        screenY: 100,
      }),
    ).toBe(false);
    expect(view.pan).not.toHaveBeenCalled();
  });

  test('selection and tap remain unclaimed', () => {
    const view = makeView();
    const h = renderHook(() =>
      usePagination('book-1', { current: view as unknown as FoliateView }, { current: null }),
    );
    expect(h.result.current.handleMousePan(point(100, 100, { hasTextSelection: true }))).toBe(
      false,
    );
    expect(h.result.current.handleMousePan(point(100, 100))).toBe(false);
    expect(
      h.result.current.handleMousePan({
        type: 'mouseup',
        bookKey: 'book-1',
        screenX: 100,
        screenY: 100,
      }),
    ).toBe(false);
    expect(view.pan).not.toHaveBeenCalled();
  });
});
