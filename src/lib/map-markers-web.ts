import { getMapIconWebUrl, MAP_ICONS } from '@/constants/map-icons';
import { isPoiMarker } from '@/lib/destination-helpers';
import { getMapMarkerColor, getMapPinSummary, getPoiMarkerIconChar, getPoiMarkerShapePath, resolveMapMarkerIconKey } from '@/lib/map-markers';
import { getTypeIconUrl } from '@/lib/type-icons';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { escapeHtml } from '@/utils/html-entities';

type MapIconKey = keyof typeof MAP_ICONS;

/**
 * Injects the shared .map-icon CSS class into the document head if not already present.
 * The 'map-icons' font-face itself is registered by expo-font at app startup
 * (see src/app/_layout.tsx) from the bundled assets/fonts/map-icons.ttf.
 */
let mapIconsFontInjected = false;

export const injectMapIconsFont = (): void => {
  if (mapIconsFontInjected || typeof document === 'undefined') return;

  const styleId = 'map-icons-font-face';
  if (document.getElementById(styleId)) {
    mapIconsFontInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .map-icon {
      font-family: 'map-icons';
      speak: none;
      font-style: normal;
      font-weight: normal;
      font-variant: normal;
      text-transform: none;
      line-height: 1;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
  mapIconsFontInjected = true;
};

// ---------------------------------------------------------------------------
// POI Marker Dimensions (per reference document)
// ---------------------------------------------------------------------------
const POI_MARKER_WIDTH = 36;
const POI_MARKER_HEIGHT = 48;
const POI_ICON_TOP_OFFSET = 10;
const POI_ICON_FONT_SIZE = 14;
/**
 * The square 48x48 shape viewBox is fitted (default xMidYMid meet) into the 36x48 box, so every shape is drawn 36px tall
 * and ends this far above the box's bottom edge.
 */
const POI_SHAPE_BOTTOM_INSET = (POI_MARKER_HEIGHT - POI_MARKER_WIDTH) / 2;

/**
 * Creates the POI marker DOM element matching the web app's structure:
 *
 * <div class="rg-map__poi-marker" style="--rg-map-poi-color:{Color};">
 *   <svg viewBox="-24 -48 48 48" class="rg-map__poi-marker-shape">
 *     <path d="{shapePathData}"></path>
 *   </svg>
 *   <span class="map-icon {iconClass} rg-map__poi-marker-icon"></span>
 * </div>
 */
const createPoiMarkerElement = (pin: MapMakerInfoData): HTMLElement => {
  const color = getMapMarkerColor(pin);
  const shapePath = getPoiMarkerShapePath(pin.Marker);
  const iconClass = pin.PoiImage || 'map-icon-map-pin';

  const wrapper = document.createElement('div');
  wrapper.className = 'rg-map__poi-marker';
  wrapper.style.setProperty('--rg-map-poi-color', color);
  wrapper.style.width = `${POI_MARKER_WIDTH}px`;
  wrapper.style.height = `${POI_MARKER_HEIGHT}px`;
  wrapper.style.position = 'relative';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'flex-start';
  wrapper.style.flexDirection = 'column';
  // Ends the marker's box at the shape's tip rather than the empty strip under it, so the bottom-anchored marker puts
  // the tip on the coordinate.
  wrapper.style.marginBottom = `-${POI_SHAPE_BOTTOM_INSET}px`;

  // SVG shape
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '-24 -48 48 48');
  svg.setAttribute('width', `${POI_MARKER_WIDTH}`);
  svg.setAttribute('height', `${POI_MARKER_HEIGHT}`);
  svg.classList.add('rg-map__poi-marker-shape');
  svg.style.filter = 'drop-shadow(0 1px 2px rgba(17, 24, 39, 0.35))';

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', shapePath);
  path.setAttribute('fill', color);

  svg.appendChild(path);
  wrapper.appendChild(svg);

  // Font icon span
  const iconSpan = document.createElement('span');
  const glyph = getPoiMarkerIconChar(iconClass);
  iconSpan.className = `map-icon ${iconClass}`;
  iconSpan.classList.add('rg-map__poi-marker-icon');
  iconSpan.textContent = glyph;
  iconSpan.style.position = 'absolute';
  iconSpan.style.top = `${POI_ICON_TOP_OFFSET}px`;
  iconSpan.style.left = '50%';
  iconSpan.style.transform = 'translateX(-50%)';
  iconSpan.style.fontSize = `${POI_ICON_FONT_SIZE}px`;
  iconSpan.style.lineHeight = '1';
  iconSpan.style.color = '#ffffff';
  iconSpan.style.pointerEvents = 'none';
  iconSpan.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(iconSpan);

  return wrapper;
};

/**
 * The Mapbox popup markup for a pin. The title and summary are server text shown as text (as the native
 * pin sheet does), so they are escaped: `Popup.setHTML` parses its string, and markup in a pin field would
 * otherwise run in the dispatcher's browser.
 */
export const buildMapPinPopupHtml = (pin: MapMakerInfoData): string => {
  const summary = getMapPinSummary(pin);
  return `<div style="padding: 8px;">
      <h3 style="margin: 0 0 8px 0; font-weight: 600;">${escapeHtml(String(pin.Title ?? ''))}</h3>
      ${summary ? `<p style="margin: 0 0 8px 0; font-size: 12px;">${escapeHtml(String(summary))}</p>` : ''}
      <p style="margin: 0; font-size: 11px; color: #666;">
        ${pin.Latitude.toFixed(6)}, ${pin.Longitude.toFixed(6)}
      </p>
    </div>`;
};

// ---------------------------------------------------------------------------
// Pin marker placement
// ---------------------------------------------------------------------------

/** Edge of the square box a non-POI pin's icon (bundled 32x37 PNG or uploaded 128x128 icon) is fitted into. */
const PIN_ICON_SIZE = 32;
/** Room below the coordinate taken by the title label hanging under the icon (2px gap + one 10px line). */
const PIN_LABEL_CLEARANCE = 16;
/** Gap between a popup's tip and the pin it belongs to. */
const PIN_POPUP_GAP = 4;

/**
 * The mapbox-gl `Marker` anchor for elements from `createMapMarkerElement`: bottom-center, as the native map's
 * `MarkerView` uses. The element's own box is just the icon (the title label hangs below it, outside the box), so the
 * bottom of the icon (the tip of a bundled pin, the bottom edge of an uploaded square icon) sits on the coordinate.
 */
export const MAP_MARKER_ANCHOR = 'bottom' as const;

const isPoiMapPin = (pin: MapMakerInfoData): boolean =>
  isPoiMarker({
    type: pin.Type,
    poiTypeId: pin.PoiTypeId,
    layerId: pin.LayerId,
    imagePath: pin.ImagePath,
    poiImage: pin.PoiImage,
  });

type PopupAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * The mapbox-gl `Popup` offset for a pin anchored with `MAP_MARKER_ANCHOR`, per popup anchor, so the popup opens clear
 * of the icon above the coordinate (or of the label below it when it flips under the pin). Sized for the tallest thing
 * the pin can show: a POI's shape (its uploaded icon is shorter), otherwise the 32px icon box.
 */
export const getMapMarkerPopupOffset = (pin: MapMakerInfoData): Record<PopupAnchor, [number, number]> => {
  const isPoi = isPoiMapPin(pin);
  const height = isPoi ? POI_MARKER_HEIGHT - POI_SHAPE_BOTTOM_INSET : PIN_ICON_SIZE;
  const halfWidth = (isPoi ? POI_MARKER_WIDTH : PIN_ICON_SIZE) / 2;
  const above = -(height + PIN_POPUP_GAP);

  return {
    center: [0, -height / 2],
    top: [0, PIN_LABEL_CLEARANCE],
    'top-left': [0, PIN_LABEL_CLEARANCE],
    'top-right': [0, PIN_LABEL_CLEARANCE],
    bottom: [0, above],
    'bottom-left': [0, above],
    'bottom-right': [0, above],
    left: [halfWidth + PIN_POPUP_GAP, -height / 2],
    right: [-(halfWidth + PIN_POPUP_GAP), -height / 2],
  };
};

/**
 * Everything a marker element from `createMapMarkerElement` and its popup are built from, prefixed with the theme
 * ("dark:" / "light:"). A map keeps a live marker while this is unchanged and rebuilds it when it changes, so it must
 * include every field the element reads: an uploaded icon, and the status/priority pin and its style, whose URL changes
 * when a unit's or person's status or a call's priority does.
 */
export const getMapMarkerSignature = (pin: MapMakerInfoData, colorScheme: 'dark' | 'light'): string =>
  `${colorScheme}:${pin.Title}:${pin.Type}:${pin.PoiTypeId}:${pin.LayerId}:${pin.ImagePath}:${pin.PoiImage}:${pin.Marker}:${pin.Color}:${pin.Address}:${pin.Note}:${pin.PoiTypeName}:${pin.InfoWindowContent}:${pin.IconUrl ?? ''}:${pin.PinIconUrl ?? ''}:${pin.IconStyle ?? ''}`;

/**
 * Creates a marker DOM element that can be used with Mapbox GL JS.
 * Handles both POI markers (SVG shape + map-icons font) and
 * non-POI legacy markers (PNG images).
 *
 * Add it with `anchor: MAP_MARKER_ANCHOR` and a popup offset from `getMapMarkerPopupOffset`: the element's box is the
 * icon alone, with the title label positioned below it, so a bottom anchor puts the icon's bottom on the coordinate.
 */
export const createMapMarkerElement = (pin: MapMakerInfoData, colorScheme: 'dark' | 'light' = 'light', onClick?: () => void): HTMLElement => {
  const isPoi = isPoiMapPin(pin);

  // Ensure map-icons font is loaded
  injectMapIconsFont();

  const el = document.createElement('div');
  el.className = 'map-marker';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.cursor = 'pointer';

  // The icon a department uploaded for the pin (its unit, call or POI type, or a person's role) wins over the built-in
  // marker; a failed load falls back to the built-in rendering.
  const uploadedIconUrl = getTypeIconUrl(pin.IconUrl);

  if (isPoi) {
    // POI marker: SVG shape + map-icons font icon, or the POI type's uploaded icon in the same width
    const poiEl = createPoiMarkerElement(pin);
    if (uploadedIconUrl) {
      const img = document.createElement('img');
      img.src = uploadedIconUrl;
      img.style.width = `${POI_MARKER_WIDTH}px`;
      img.style.height = `${POI_MARKER_WIDTH}px`;
      img.style.objectFit = 'contain';
      img.alt = pin.Title;
      img.onerror = () => {
        img.onerror = null;
        img.replaceWith(poiEl);
      };
      el.appendChild(img);
    } else {
      el.appendChild(poiEl);
    }
  } else {
    // Non-POI legacy marker: PNG image
    const iconContainer = document.createElement('div');
    iconContainer.style.display = 'flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';
    iconContainer.style.width = `${PIN_ICON_SIZE}px`;
    iconContainer.style.height = `${PIN_ICON_SIZE}px`;

    const iconKey = resolveMapMarkerIconKey(pin) as MapIconKey;
    const iconData = MAP_ICONS[iconKey] || MAP_ICONS['flag'];
    const img = document.createElement('img');
    // The built-in pin recoloured to the call's priority or the unit's / person's status: the same 32x37 image as the
    // bundled pin, so it takes the bundled pin's place in the same box and fit, with no tint.
    const statusPinUrl = getTypeIconUrl(pin.PinIconUrl);
    // The uploaded type icon (when there is one) shows first, then the status/priority pin; each failed load steps down
    // to the bundled icon, then the flag, and stops there rather than retrying a broken image forever.
    const sources = [uploadedIconUrl, statusPinUrl, getMapIconWebUrl(iconData), getMapIconWebUrl(MAP_ICONS['flag'])].filter((src, index, all): src is string => !!src && all.indexOf(src) === index);
    let sourceIndex = 0;
    img.src = sources[sourceIndex];
    // Fitted, not cropped: a bundled 32x37 pin (or its status/priority copy) scales into the box with its tip on the
    // box's bottom edge, and an uploaded square icon fills it.
    img.style.width = `${PIN_ICON_SIZE}px`;
    img.style.height = `${PIN_ICON_SIZE}px`;
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center bottom';
    img.alt = pin.Title;
    img.onerror = () => {
      sourceIndex += 1;
      if (sourceIndex < sources.length) {
        img.src = sources[sourceIndex];
      } else {
        img.onerror = null;
      }
    };
    iconContainer.appendChild(img);
    el.appendChild(iconContainer);
  }

  // Title label, hung below the icon outside the element's box so the bottom anchor lands on the icon, not the label.
  // (mapbox-gl's .mapboxgl-marker class makes the element absolutely positioned, which is the label's containing block;
  // the element itself must not set `position`, or it would override that class.)
  const title = document.createElement('div');
  title.textContent = pin.Title;
  title.style.position = 'absolute';
  title.style.top = '100%';
  title.style.left = '50%';
  title.style.transform = 'translateX(-50%)';
  title.style.fontSize = '10px';
  title.style.fontWeight = '600';
  title.style.textAlign = 'center';
  title.style.marginTop = '2px';
  title.style.maxWidth = '80px';
  title.style.overflow = 'hidden';
  title.style.textOverflow = 'ellipsis';
  title.style.whiteSpace = 'nowrap';
  title.style.color = colorScheme === 'dark' ? '#ffffff' : '#000000';
  title.style.textShadow = colorScheme === 'dark' ? '0 0 2px rgba(0,0,0,0.8)' : '0 0 2px rgba(255,255,255,0.8)';
  el.appendChild(title);

  if (onClick) {
    el.addEventListener('click', onClick);
  }

  return el;
};
