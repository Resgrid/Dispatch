/**
 * @jest-environment jsdom
 */
import { buildMapPinPopupHtml, createMapMarkerElement, getMapMarkerPopupOffset, MAP_MARKER_ANCHOR } from '@/lib/map-markers-web';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

const pin = (patch: Partial<MapMakerInfoData> = {}): MapMakerInfoData =>
  ({ Id: 'u12', Title: 'Engine 41', Latitude: 39.5, Longitude: -119.8, Address: '', Note: '', PoiTypeName: '', InfoWindowContent: '', ...patch }) as MapMakerInfoData;

describe('buildMapPinPopupHtml', () => {
  it('shows the title, summary and coordinates', () => {
    const html = buildMapPinPopupHtml(pin({ Address: '123 Main St' }));

    expect(html).toContain('>Engine 41</h3>');
    expect(html).toContain('>123 Main St</p>');
    expect(html).toContain('39.500000, -119.800000');
  });

  it('escapes markup in the title and summary so it shows as text instead of running', () => {
    const html = buildMapPinPopupHtml(pin({ Title: '<img src=x onerror=alert(1)>', InfoWindowContent: '<script>alert(2)</script>' }));

    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  it('omits the summary line when the pin has none', () => {
    expect(buildMapPinPopupHtml(pin())).not.toContain('font-size: 12px');
  });
});

describe('createMapMarkerElement type icons', () => {
  const ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/u12.png';
  const iconSrc = (el: HTMLElement) => el.querySelector('img')?.getAttribute('src');
  const failImage = (el: HTMLElement) => el.querySelector('img')?.dispatchEvent(new Event('error'));

  it('shows the uploaded type icon on a unit pin, stepping down to the bundled icon and then the flag when loads fail', () => {
    const el = createMapMarkerElement(pin({ Type: 1, ImagePath: 'ambulance', IconUrl: ICON_URL }));

    expect(iconSrc(el)).toBe(ICON_URL);
    failImage(el);
    expect(iconSrc(el)).toBe('/assets/mapping/ambulance.png');
    failImage(el);
    expect(iconSrc(el)).toBe('/assets/mapping/flag.png');
    // Out of options: it stops rather than retrying the broken image forever
    failImage(el);
    expect(iconSrc(el)).toBe('/assets/mapping/flag.png');
    expect(el.querySelector('img')?.onerror).toBeNull();
  });

  it('keeps the bundled icon for a pin without an uploaded icon (older servers omit IconUrl)', () => {
    expect(iconSrc(createMapMarkerElement(pin({ Type: 1, ImagePath: 'ambulance' })))).toBe('/assets/mapping/ambulance.png');
    expect(iconSrc(createMapMarkerElement(pin({ Type: 1, ImagePath: 'ambulance', IconUrl: null })))).toBe('/assets/mapping/ambulance.png');
    expect(iconSrc(createMapMarkerElement(pin({ Type: 0, ImagePath: 'fire' })))).toBe('/assets/mapping/fire.png');
  });

  it('shows the call type icon on a call pin, falling back to the bundled call icon', () => {
    const el = createMapMarkerElement(pin({ Id: 'c7', Type: 0, ImagePath: 'fire', IconUrl: ICON_URL }));

    expect(iconSrc(el)).toBe(ICON_URL);
    failImage(el);
    expect(iconSrc(el)).toBe('/assets/mapping/fire.png');
  });

  it('shows the POI type icon instead of the shape marker, and the shape marker when it fails to load', () => {
    const el = createMapMarkerElement(pin({ Id: 'p3', Type: 4, PoiTypeId: 5, PoiImage: 'map-icon-hospital', Marker: 'MAP_PIN', IconUrl: ICON_URL }));

    expect(iconSrc(el)).toBe(ICON_URL);
    expect(el.querySelector('.rg-map__poi-marker')).toBeNull();

    failImage(el);

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.rg-map__poi-marker')).not.toBeNull();
    // The title label stays after the marker it replaced
    expect(el.lastElementChild?.textContent).toBe('Engine 41');
  });

  it('keeps the POI shape marker when the POI type has no uploaded icon', () => {
    const el = createMapMarkerElement(pin({ Type: 4, PoiTypeId: 5, PoiImage: 'map-icon-hospital', IconUrl: null }));

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.rg-map__poi-marker')).not.toBeNull();
  });

  it('ignores an IconUrl that is not an absolute http(s) URL', () => {
    expect(iconSrc(createMapMarkerElement(pin({ Type: 1, ImagePath: 'truck', IconUrl: 'javascript:alert(1)' })))).toBe('/assets/mapping/truck.png');
    expect(createMapMarkerElement(pin({ Type: 4, PoiTypeId: 5, IconUrl: '/api/v4/TypeIcons/p5.png' })).querySelector('img')).toBeNull();
  });

  describe('personnel pins (Type 3)', () => {
    const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/r4.png';
    const person = (patch: Partial<MapMakerInfoData> = {}) => pin({ Id: 'p1f6a', Title: 'Jane Doe', Type: 3, ImagePath: 'Person_RespondingCall', ...patch });

    it("shows the role's uploaded icon as a 32px square like other uploaded pins, stepping down to the bundled person pin", () => {
      const el = createMapMarkerElement(person({ IconUrl: ROLE_ICON_URL }));
      const img = el.querySelector('img')!;

      expect(iconSrc(el)).toBe(ROLE_ICON_URL);
      expect(img.style.width).toBe('32px');
      expect(img.style.height).toBe('32px');
      expect(img.style.objectFit).toBe('contain');
      expect(el.querySelector('.rg-map__poi-marker')).toBeNull();

      failImage(el);
      expect(iconSrc(el)).toBe('/assets/mapping/person_respondingcall.png');
      failImage(el);
      expect(iconSrc(el)).toBe('/assets/mapping/flag.png');
    });

    it('keeps the bundled person pin when none of their roles has an icon', () => {
      expect(iconSrc(createMapMarkerElement(person({ IconUrl: null })))).toBe('/assets/mapping/person_respondingcall.png');
      expect(iconSrc(createMapMarkerElement(person()))).toBe('/assets/mapping/person_respondingcall.png');
      expect(iconSrc(createMapMarkerElement(person({ ImagePath: '' })))).toBe('/assets/mapping/person.png');
    });
  });
});

describe('createMapMarkerElement placement', () => {
  const ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/u12.png';
  // jsdom does no layout, so the marker's box is read from its children's styles: only in-flow children size it.
  const inFlowChildren = (el: HTMLElement) => Array.from(el.children).filter((child) => (child as HTMLElement).style.position !== 'absolute') as HTMLElement[];
  const label = (el: HTMLElement) => el.lastElementChild as HTMLElement;

  it('is bottom-anchored, like the native pins', () => {
    expect(MAP_MARKER_ANCHOR).toBe('bottom');
  });

  it.each([
    ['a bundled 32x37 pin', pin({ Type: 1, ImagePath: 'ambulance' })],
    ['an uploaded square icon', pin({ Type: 1, ImagePath: 'ambulance', IconUrl: ICON_URL })],
    ['a personnel role icon', pin({ Type: 3, ImagePath: 'Person_RespondingCall', IconUrl: ICON_URL })],
  ])('sizes the marker to the 32px icon alone for %s, so its bottom sits on the coordinate', (_name, markerPin) => {
    const el = createMapMarkerElement(markerPin);
    const [iconBox] = inFlowChildren(el);
    const img = el.querySelector('img')!;

    expect(inFlowChildren(el)).toHaveLength(1);
    expect(iconBox.style.height).toBe('32px');
    // Fitted into the box against its bottom edge: a 32x37 pin keeps its tip on the edge, a square icon fills the box.
    expect(img.style.height).toBe('32px');
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.objectPosition).toBe('center bottom');
  });

  it('hangs the title label below the icon, outside the box the anchor measures', () => {
    const el = createMapMarkerElement(pin({ Type: 0, ImagePath: 'fire' }));

    expect(label(el).textContent).toBe('Engine 41');
    expect(label(el).style.position).toBe('absolute');
    expect(label(el).style.top).toBe('100%');
    expect(label(el).style.transform).toBe('translateX(-50%)');
    // The element itself leaves `position` to mapbox-gl's .mapboxgl-marker class.
    expect(el.style.position).toBe('');
  });

  it("ends a POI shape marker's box at the shape's tip, not the empty strip below it", () => {
    const el = createMapMarkerElement(pin({ Type: 4, PoiTypeId: 5, PoiImage: 'map-icon-hospital', Marker: 'MAP_PIN' }));
    const shape = el.querySelector('.rg-map__poi-marker') as HTMLElement;

    expect(inFlowChildren(el)).toEqual([shape]);
    expect(shape.style.height).toBe('48px');
    expect(shape.style.marginBottom).toBe('-6px');
  });
});

describe('getMapMarkerPopupOffset', () => {
  it('opens the popup clear of a 32px pin above the coordinate, or of its label below it', () => {
    const offset = getMapMarkerPopupOffset(pin({ Type: 3, ImagePath: 'Person_RespondingCall' }));

    expect(offset.bottom).toEqual([0, -36]);
    expect(offset['bottom-left']).toEqual([0, -36]);
    expect(offset.top).toEqual([0, 16]);
    expect(offset.left).toEqual([20, -16]);
    expect(offset.right).toEqual([-20, -16]);
  });

  it('clears the taller POI shape', () => {
    expect(getMapMarkerPopupOffset(pin({ Type: 4, PoiTypeId: 5, PoiImage: 'map-icon-hospital' })).bottom).toEqual([0, -46]);
  });
});
