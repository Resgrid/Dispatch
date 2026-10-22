import { contentOnFill, contrastRatio, MARK_CONTRAST, normalizeColor, parseColor, readableOnSurface, TEXT_CONTRAST, THEME_SURFACES, tintOf } from '../readable-color';

describe('readable-color', () => {
  describe('parseColor / normalizeColor', () => {
    it('reads 3, 4, 6 and 8 digit hex and rgb()', () => {
      expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColor('#2f9e44')).toEqual({ r: 47, g: 158, b: 68 });
      expect(parseColor('#2f9e44cc')).toEqual({ r: 47, g: 158, b: 68 });
      expect(parseColor('#fffa')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30 });
      expect(parseColor('rgba(10,20,30,0.5)')).toEqual({ r: 10, g: 20, b: 30 });
    });

    it('returns null for names, label classes and empty values', () => {
      expect(parseColor('label-default')).toBeNull();
      expect(parseColor('red')).toBeNull();
      expect(parseColor('')).toBeNull();
      expect(parseColor(undefined)).toBeNull();
    });

    it('expands short hex so an alpha suffix can be appended', () => {
      expect(normalizeColor('#000')).toBe('#000000');
      expect(normalizeColor('label-default')).toBe('label-default');
    });
  });

  describe('readableOnSurface', () => {
    it('lightens black in dark mode until it reads as text', () => {
      const color = readableOnSurface('#000', 'dark', TEXT_CONTRAST);
      expect(color).not.toBe('#000');
      expect(contrastRatio(color, THEME_SURFACES.dark)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });

    it('darkens white and pale yellow in light mode until they read', () => {
      for (const pale of ['#ffffff', '#ffff99', '#DBDB2E']) {
        const color = readableOnSurface(pale, 'light', TEXT_CONTRAST);
        expect(contrastRatio(color, THEME_SURFACES.light)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      }
    });

    it('keeps the hue: a dark red stays red when lightened', () => {
      const color = parseColor(readableOnSurface('#7f0000', 'dark', TEXT_CONTRAST));
      expect(color).not.toBeNull();
      expect(color!.r).toBeGreaterThan(color!.g);
      expect(color!.r).toBeGreaterThan(color!.b);
    });

    it('returns a colour that already reads unchanged, as given', () => {
      expect(readableOnSurface('#e03131', 'light', MARK_CONTRAST)).toBe('#e03131');
      expect(readableOnSurface('#f08c00', 'dark', TEXT_CONTRAST)).toBe('#f08c00');
    });

    it('marks (dots, borders) need less contrast than text', () => {
      const mark = readableOnSurface('#2f9e44', 'light', MARK_CONTRAST);
      expect(mark).toBe('#2f9e44');
      expect(contrastRatio(readableOnSurface('#2f9e44', 'light', TEXT_CONTRAST), THEME_SURFACES.light)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    });

    it('leaves unparseable input alone so the caller fallback applies', () => {
      expect(readableOnSurface('label-default', 'dark')).toBe('label-default');
      expect(readableOnSurface(undefined, 'dark')).toBe('');
    });
  });

  describe('contentOnFill', () => {
    it('picks dark content on light fills and white on dark fills', () => {
      expect(contentOnFill('#ffff99')).toBe('#111827');
      expect(contentOnFill('#000')).toBe('#ffffff');
      expect(contentOnFill('#e03131')).toBe('#ffffff');
    });

    it('falls back to white for an unparseable fill', () => {
      expect(contentOnFill('label-default')).toBe('#ffffff');
    });
  });

  describe('tintOf', () => {
    it('builds a valid 8-digit wash from short hex (the old `${color}18` made "#00018")', () => {
      expect(tintOf('#000')).toBe('#00000018');
      expect(tintOf('#2f9e44', '20')).toBe('#2f9e4420');
    });

    it('is transparent for an unparseable colour', () => {
      expect(tintOf('label-default')).toBe('transparent');
    });
  });
});
