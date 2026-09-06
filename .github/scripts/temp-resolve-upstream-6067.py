from pathlib import Path

hook = Path('apps/readest-app/src/app/reader/hooks/useBookShortcuts.ts')
text = hook.read_text()

old = "  const { setSettingsDialogOpen, setSettingsDialogBookKey } = useSettingsStore();"
new = "  const { settings, setSettingsDialogOpen, setSettingsDialogBookKey } = useSettingsStore();"
if text.count(old) != 1:
    raise SystemExit('unexpected settingsStore destructuring while resolving #6067')
text = text.replace(old, new)

old_zoom = """  const zoomInFactor = (factor = 1.0) => {
    if (!sideBarBookKey) return;
    const viewSettings = getViewSettings(sideBarBookKey)!;
    const zoomLevel = viewSettings!.zoomLevel + ZOOM_STEP * factor;
    applyZoomLevel(Math.min(zoomLevel, MAX_ZOOM_LEVEL));
  };

  const zoomOutFactor = (factor = 1.0) => {
    if (!sideBarBookKey) return;
    const viewSettings = getViewSettings(sideBarBookKey)!;
    const zoomLevel = viewSettings!.zoomLevel - ZOOM_STEP * factor;
    applyZoomLevel(Math.max(zoomLevel, MIN_ZOOM_LEVEL));
  };
"""
new_zoom = """  const applyFontSize = (fontSize: number) => {
    if (!sideBarBookKey) return;
    const viewSettings = getViewSettings(sideBarBookKey);
    if (!viewSettings) return;
    const minSize = Math.max(
      FONT_SIZE_LIMITS.MIN,
      viewSettings.minimumFontSize ?? FONT_SIZE_LIMITS.MIN,
    );
    const clamped = Math.max(
      minSize,
      Math.min(FONT_SIZE_LIMITS.MAX, Math.round(fontSize)),
    );
    if (clamped === viewSettings.defaultFontSize) return;
    saveViewSettings(envConfig, sideBarBookKey, 'defaultFontSize', clamped, true);
  };

  const isFixedLayout = () => !!getBookData(sideBarBookKey ?? '')?.isFixedLayout;

  const zoomInFactor = (factor = 1.0) => {
    if (!sideBarBookKey) return;
    const viewSettings = getViewSettings(sideBarBookKey)!;
    if (!isFixedLayout()) {
      applyFontSize(viewSettings.defaultFontSize + factor);
      return;
    }
    const zoomLevel = viewSettings!.zoomLevel + ZOOM_STEP * factor;
    applyZoomLevel(Math.min(zoomLevel, MAX_ZOOM_LEVEL));
  };

  const zoomOutFactor = (factor = 1.0) => {
    if (!sideBarBookKey) return;
    const viewSettings = getViewSettings(sideBarBookKey)!;
    if (!isFixedLayout()) {
      applyFontSize(viewSettings.defaultFontSize - factor);
      return;
    }
    const zoomLevel = viewSettings!.zoomLevel - ZOOM_STEP * factor;
    applyZoomLevel(Math.max(zoomLevel, MIN_ZOOM_LEVEL));
  };
"""
if text.count(old_zoom) != 1:
    raise SystemExit('unexpected zoom factor block while resolving #6067')
text = text.replace(old_zoom, new_zoom)

old_save = "      saveViewSettings(envConfig, sideBarBookKey, 'defaultFontSize', size);"
new_save = "      saveViewSettings(envConfig, sideBarBookKey, 'defaultFontSize', size, true);"
if text.count(old_save) != 1:
    raise SystemExit('unexpected Ctrl+wheel save call while resolving #6067')
text = text.replace(old_save, new_save)

old_reset = """  const resetZoom = () => {
    if (!sideBarBookKey) return;
    applyZoomLevel(100);
  };
"""
new_reset = """  const resetZoom = () => {
    if (!sideBarBookKey) return;
    if (!isFixedLayout()) {
      applyFontSize(settings.globalViewSettings?.defaultFontSize ?? FONT_SIZE_LIMITS.DEFAULT);
      return;
    }
    applyZoomLevel(100);
  };
"""
if text.count(old_reset) != 1:
    raise SystemExit('unexpected resetZoom block while resolving #6067')
text = text.replace(old_reset, new_reset)
hook.write_text(text)

test = Path('apps/readest-app/src/__tests__/components/useBookShortcuts.test.tsx')
test_text = test.read_text()
marker = "vi.mock('@/services/constants', () => ({\n"
if marker not in test_text:
    raise SystemExit('constants mock not found in #6067 test')
if 'FONT_SIZE_LIMITS:' not in test_text:
    test_text = test_text.replace(
        marker,
        marker + "  FONT_SIZE_LIMITS: { MIN: 8, MAX: 50, DEFAULT: 16 },\n",
        1,
    )
test.write_text(test_text)
