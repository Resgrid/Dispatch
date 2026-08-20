import { getMapIconWebUrl, MAP_ICONS } from '@/constants/map-icons';
import { isPoiMarker } from '@/lib/destination-helpers';
import { getMapMarkerColor, getPoiMarkerIconChar, getPoiMarkerShapePath, resolveMapMarkerIconKey } from '@/lib/map-markers';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

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
 * Creates a marker DOM element that can be used with Mapbox GL JS.
 * Handles both POI markers (SVG shape + map-icons font) and
 * non-POI legacy markers (PNG images).
 */
export const createMapMarkerElement = (pin: MapMakerInfoData, colorScheme: 'dark' | 'light' = 'light', onClick?: () => void): HTMLElement => {
  const isPoi = isPoiMarker({
    type: pin.Type,
    poiTypeId: pin.PoiTypeId,
    layerId: pin.LayerId,
    imagePath: pin.ImagePath,
    poiImage: pin.PoiImage,
  });

  // Ensure map-icons font is loaded
  injectMapIconsFont();

  const el = document.createElement('div');
  el.className = 'map-marker';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.cursor = 'pointer';

  if (isPoi) {
    // POI marker: SVG shape + map-icons font icon
    const poiEl = createPoiMarkerElement(pin);
    el.appendChild(poiEl);
  } else {
    // Non-POI legacy marker: PNG image
    const iconContainer = document.createElement('div');
    iconContainer.style.display = 'flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';
    iconContainer.style.width = '32px';
    iconContainer.style.height = '32px';

    const iconKey = resolveMapMarkerIconKey(pin) as MapIconKey;
    const iconData = MAP_ICONS[iconKey] || MAP_ICONS['flag'];
    const img = document.createElement('img');
    const imgSrc = getMapIconWebUrl(iconData);
    img.src = imgSrc;
    img.style.width = '32px';
    img.style.height = '32px';
    img.style.objectFit = 'contain';
    img.alt = pin.Title;
    img.onerror = () => {
      img.src = getMapIconWebUrl(MAP_ICONS['flag']);
    };
    iconContainer.appendChild(img);
    el.appendChild(iconContainer);
  }

  // Title label
  const title = document.createElement('div');
  title.textContent = pin.Title;
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
