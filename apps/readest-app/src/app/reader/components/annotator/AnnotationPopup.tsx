import clsx from 'clsx';
import React from 'react';
import { Position } from '@/utils/sel';
import { BookNote, HighlightColor, HighlightStyle } from '@/types/book';
import Popup from '@/components/Popup';
import AnnotationToolButton from './AnnotationToolButton';
import AnnotationNotes from './AnnotationNotes';
import HighlightOptions from './HighlightOptions';

interface AnnotationPopupProps {
  bookKey: string;
  dir: 'ltr' | 'rtl';
  isVertical: boolean;
  buttons: Array<{
    tooltipText: string;
    Icon: React.ElementType;
    onClick: () => void;
    disabled?: boolean;
    visible?: boolean;
  }>;
  notes: BookNote[];
  position: Position;
  trianglePosition: Position;
  highlightOptionsVisible: boolean;
  selectedStyle: HighlightStyle;
  selectedColor: HighlightColor;
  popupWidth: number;
  popupHeight: number;
  globalToggleAvailable?: boolean;
  globalToggleActive?: boolean;
  onToggleGlobal?: () => void;
  onHighlight: (update?: boolean) => void;
  onDismiss: () => void;
}

const AnnotationPopup: React.FC<AnnotationPopupProps> = ({
  bookKey,
  dir,
  isVertical,
  buttons,
  notes,
  position,
  trianglePosition,
  highlightOptionsVisible,
  selectedStyle,
  selectedColor,
  popupWidth,
  popupHeight,
  globalToggleAvailable,
  globalToggleActive,
  onToggleGlobal,
  onHighlight,
  onDismiss,
}) => {
  return (
    // The toolbar opens against the selection, which is where the range
    // editors' handles hang: the two overlap by design, and whichever layer
    // wins owns those pixels. The handles are grab targets, so they take it —
    // under the toolbar their covered part stops dragging and fires whichever
    // tool button it landed on instead. Hence z-[43], below the handle layer
    // (z-[44]) but still above the paragraph/TTS chrome (z-40). Every other
    // popup surface stays at z-50 and above the handles, which is why the
    // wrapper is `fixed inset-0`: it makes the stacking context without
    // moving the popup, whose containing block is still the viewport.
    // `pointer-events-none` keeps the full-screen wrapper from swallowing the
    // taps outside the popup that dismiss it.
    <div dir={dir} className='pointer-events-none fixed inset-0 z-[43]'>
      <Popup
        width={isVertical ? popupHeight : popupWidth}
        height={isVertical ? popupWidth : popupHeight}
        minHeight={isVertical ? popupWidth : popupHeight}
        position={position}
        trianglePosition={trianglePosition}
        className={clsx('selection-popup pointer-events-auto', notes.length > 0 && 'bg-transparent')}
        onDismiss={onDismiss}
      >
        <div className={clsx('flex h-full gap-4', isVertical ? 'flex-row' : 'flex-col')}>
          <div
            className={clsx(
              'selection-buttons flex h-full w-full items-center justify-between p-2',
              isVertical ? 'flex-col overflow-y-auto' : 'flex-row overflow-x-auto',
              notes.length > 0 && 'hidden',
            )}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {buttons.map((button, index) => {
              if (button.visible === false) return null;
              return (
                <AnnotationToolButton
                  key={index}
                  showTooltip={!highlightOptionsVisible}
                  tooltipText={button.tooltipText}
                  Icon={button.Icon}
                  onClick={button.onClick}
                  disabled={button.disabled}
                />
              );
            })}
          </div>
          {notes.length > 0 ? (
            <AnnotationNotes
              bookKey={bookKey}
              isVertical={isVertical}
              notes={notes}
              toolsVisible={false}
              triangleDir={trianglePosition.dir!}
              popupWidth={isVertical ? popupHeight : popupWidth}
              popupHeight={isVertical ? popupWidth : popupHeight}
              onDismiss={onDismiss}
            />
          ) : (
            highlightOptionsVisible && (
              <HighlightOptions
                isVertical={isVertical}
                triangleDir={trianglePosition.dir!}
                popupWidth={isVertical ? popupHeight : popupWidth}
                popupHeight={isVertical ? popupWidth : popupHeight}
                selectedStyle={selectedStyle}
                selectedColor={selectedColor}
                globalToggleAvailable={globalToggleAvailable}
                globalToggleActive={globalToggleActive}
                onToggleGlobal={onToggleGlobal}
                onHandleHighlight={onHighlight}
              />
            )
          )}
        </div>
      </Popup>
    </div>
  );
};

export default AnnotationPopup;
