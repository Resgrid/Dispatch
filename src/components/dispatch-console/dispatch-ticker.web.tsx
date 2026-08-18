import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';

import { dedupeDispatches, getDispatchTypeStyle } from './dispatch-ticker-shared';

/**
 * Web ticker/badge implementation.
 *
 * The native build animates these with `Animated`, which on react-native-web falls back to
 * `useNativeDriver: false` — a requestAnimationFrame loop writing inline styles on every frame,
 * per call card, forever. The dispatch console keeps a dozen of those alive at idle. CSS
 * keyframes hand the same motion to the compositor and cost no JS per frame.
 */

const KEYFRAMES_ID = 'rg-dispatch-ticker-keyframes';
const KEYFRAMES = `
@keyframes rg-ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes rg-ticker-blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .rg-ticker-track { animation: none !important; }
  .rg-ticker-badge-blink { animation: none !important; }
}
`;

// Injected once per document rather than per component: a <style> tag inside every badge would
// add a node (and a style recalc) per dispatched resource.
function ensureKeyframes(): void {
  if (typeof document === 'undefined' || document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

const SCROLL_SPEED_PX_PER_SEC = 60;

export const DispatchBadge: React.FC<{ dispatch: DispatchedEventResultData; isOverdue?: boolean }> = React.memo(({ dispatch, isOverdue }) => {
  ensureKeyframes();
  const ts = getDispatchTypeStyle(dispatch.Type);
  const bgColor = isOverdue ? '#dc2626' : ts.bg;

  return (
    <div
      className={isOverdue ? 'rg-ticker-badge-blink' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 3,
        overflow: 'hidden',
        height: 14,
        flexShrink: 0,
        backgroundColor: bgColor,
        animation: isOverdue ? 'rg-ticker-blink 1s linear infinite' : undefined,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, padding: '0 3px', color: ts.fg, whiteSpace: 'nowrap' }}>{ts.label}</span>
      <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.35)' }} />
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          padding: '0 4px',
          color: ts.fg,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {dispatch.Name}
      </span>
    </div>
  );
});

DispatchBadge.displayName = 'DispatchBadge';

const BadgeRow: React.FC<{
  dispatches: DispatchedEventResultData[];
  overdueEntityIds?: Set<string>;
  ariaHidden?: boolean;
}> = ({ dispatches, overdueEntityIds, ariaHidden }) => (
  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 }} aria-hidden={ariaHidden}>
    {dispatches.map((d) => (
      <DispatchBadge key={d.Id || `${d.Type}:${d.Name}`} dispatch={d} isOverdue={overdueEntityIds?.has(d.Id)} />
    ))}
  </div>
);

export const DispatchTicker: React.FC<{
  dispatches: DispatchedEventResultData[];
  isLoading?: boolean;
  textColor?: string;
  overdueEntityIds?: Set<string>;
}> = React.memo(({ dispatches, isLoading, textColor = '#ffffff', overdueEntityIds }) => {
  ensureKeyframes();

  const uniqueDispatches = useMemo(() => dedupeDispatches(dispatches), [dispatches]);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  // null = not measured yet; a number = seconds for one full loop. Scrolling is off until a
  // measurement proves the content actually overflows, so short tickers never animate at all.
  const [scrollDuration, setScrollDuration] = useState<number | null>(null);

  // Measured once per content/size change, never per frame. Guarded against writing the same
  // value back so the measure → setState → render → measure cycle terminates.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = measureRef.current;
    if (!container || !content || uniqueDispatches.length === 0) {
      setScrollDuration((prev) => (prev === null ? prev : null));
      return;
    }

    const measure = () => {
      const containerWidth = container.clientWidth;
      const contentWidth = content.scrollWidth;
      if (containerWidth <= 0 || contentWidth <= 0 || contentWidth <= containerWidth) {
        setScrollDuration((prev) => (prev === null ? prev : null));
        return;
      }
      // The track holds two copies of the row and travels -50%, so one loop covers exactly
      // one copy's width plus the gap between them.
      const next = Math.max(4, (contentWidth + 5) / SCROLL_SPEED_PX_PER_SEC);
      setScrollDuration((prev) => (prev !== null && Math.abs(prev - next) < 0.05 ? prev : next));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [uniqueDispatches]);

  const containerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    height: 18,
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  };

  if (isLoading || uniqueDispatches.length === 0) {
    return (
      <div ref={containerRef} style={containerStyle}>
        <span style={{ fontSize: 9, fontStyle: 'italic', color: `${textColor}80` }}>{isLoading ? '…' : '—'}</span>
      </div>
    );
  }

  const isScrolling = scrollDuration !== null;

  return (
    <div ref={containerRef} style={containerStyle}>
      <div
        className={isScrolling ? 'rg-ticker-track' : undefined}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          willChange: isScrolling ? 'transform' : undefined,
          animation: isScrolling ? `rg-ticker-scroll ${scrollDuration}s linear infinite` : undefined,
        }}
      >
        <div ref={measureRef} style={{ display: 'flex', flexShrink: 0 }}>
          <BadgeRow dispatches={uniqueDispatches} overdueEntityIds={overdueEntityIds} />
        </div>
        {isScrolling ? <BadgeRow dispatches={uniqueDispatches} overdueEntityIds={overdueEntityIds} ariaHidden /> : null}
      </div>
    </div>
  );
});

DispatchTicker.displayName = 'DispatchTicker';
