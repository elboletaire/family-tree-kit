/* The DATA that scripts/build_site.py generates has the shape of src/types.ts. It uses the webs already built
   (build/web/index.html, or the one in ARBRE_WEB, build/public/index.html and build/private/data.json); those that do
   not exist are skipped: `make html` builds them and runs this test. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../src/i18n';
import { checkData } from './contract';
import { fixture, privateFixture, publicFixture } from './fixture';

const build = (dir: string) => resolve(__dirname, '..', dir);
// The whole web, the public version and the private data of the site (`make html` generates the three)
const pages = [
  { name: process.env.ARBRE_WEB ?? 'build/web', file: resolve(build(process.env.ARBRE_WEB ?? '../build/web'), 'index.html'), access: 'full' },
  { name: 'build/public', file: resolve(build('../build/public'), 'index.html'), access: 'public' },
  { name: 'build/private', file: resolve(build('../build/private'), 'data.json'), access: 'private' },
];

function readData(file: string): unknown {
  const text = readFileSync(file, 'utf-8');
  if (file.endsWith('.json')) return JSON.parse(text);
  const start = text.indexOf('const DATA = ') + 'const DATA = '.length;
  return JSON.parse(text.slice(start, text.indexOf(';</script>', start)));
}

describe('DATA contract', () => {
  it('the test family meets the contract', () => {
    expect(checkData(fixture())).toEqual([]);
    expect(checkData(publicFixture())).toEqual([]);
    expect(checkData(privateFixture())).toEqual([]);
  });
  it('detects new, missing or mistyped keys', () => {
    const d = fixture() as unknown as { people: Record<string, unknown>[]; main: unknown };
    d.people[0].nickname = 'x';
    delete d.people[1].born;
    d.people[2].gen = '1';
    d.main = 3;
    expect(checkData(d)).toEqual([
      'DATA.people[0].nickname: key not in src/types.ts',
      'DATA.people[1].born: missing',
      'DATA.people[2].gen: expected number',
      'DATA.main: expected text',
    ]);
  });
  for (const { name, file, access } of pages) {
    it.skipIf(!existsSync(file))(`the DATA of ${name} meets the contract`, () => {
      const data = readData(file);
      expect(checkData(data).slice(0, 20)).toEqual([]);
      expect((data as { access: string }).access).toBe(access);
    });
  }
  it.skipIf(!existsSync(pages[0].file))('its language (`language` in families.yml) has texts in src/i18n', () => {
    const lang = /<html lang="([^"]*)">/.exec(readFileSync(pages[0].file, 'utf-8'))?.[1];
    expect(Object.keys(LANGUAGES)).toContain(lang);
  });
});
