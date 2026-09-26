import { buildMapPinPopupHtml } from '@/lib/map-markers-web';
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
