/* Texts of the interface in the tree's language (`language` in families.yml). build_site.py writes it in the page's
   <html lang>, and the dictionary is picked from there (Spanish when it is missing, as in the tests). */
import { es } from './es';

export type Texts = typeof es;
/** Languages the interface has texts for: scripts/i18n_<language>.py needs its counterpart here */
export const LANGUAGES: Record<string, Texts> = { es };

const lang = typeof document === 'undefined' ? '' : document.documentElement.lang;
export const texts: Texts = LANGUAGES[lang] ?? es;
