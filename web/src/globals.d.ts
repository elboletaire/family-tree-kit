import type { Data } from './types';

declare global {
  /** Data that scripts/build_site.py writes into index.html (`const DATA = …`) before this bundle */
  const DATA: Data;
}
