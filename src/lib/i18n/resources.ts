import ar from '@/translations/ar.json';
import de from '@/translations/de.json';
import el from '@/translations/el.json';
import en from '@/translations/en.json';
import es from '@/translations/es.json';
import fr from '@/translations/fr.json';
import it from '@/translations/it.json';
import pl from '@/translations/pl.json';
import sv from '@/translations/sv.json';
import uk from '@/translations/uk.json';

export const resources = {
  en: {
    translation: en,
  },
  es: {
    translation: es,
  },
  sv: {
    translation: sv,
  },
  de: {
    translation: de,
  },
  fr: {
    translation: fr,
  },
  it: {
    translation: it,
  },
  pl: {
    translation: pl,
  },
  uk: {
    translation: uk,
  },
  ar: {
    translation: ar,
  },
  el: {
    translation: el,
  },
};

export type Language = keyof typeof resources;
