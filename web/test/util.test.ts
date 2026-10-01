import { describe, expect, it } from 'vitest';
import { esc, fmtDate, hash, initials, lifespan, lightColor, norm, splitUrls, years, yearAt } from '../src/util';
import { fixture } from './fixture';

const people = new Map(fixture().people.map(p => [p.id, p]));
const p = (id: string) => people.get(id)!;

describe('helpers', () => {
  it('esc escapes HTML', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(esc(null)).toBe('');
    expect(esc(3)).toBe('3');
  });
  it('initials uses the given name and first surname', () => {
    expect(initials(p('jose-nunez'))).toBe('JN');
    expect(initials({ ...p('yo'), given: '', surnames: '' })).toBe('?');
  });
  it('lifespan and years mark the unknown', () => {
    expect(lifespan(p('abuelo'))).toBe('1900-03-02 – 1970');
    expect(lifespan(p('abuela'))).toBe('1905 – ?');
    expect(lifespan(p('yo'))).toBe('1960-01-15 – ');
    expect(lifespan(p('hermana'))).toBe('');
    expect(years(p('abuelo'))).toBe('1900–1970');
    expect(years(p('abuela'))).toBe('1905–?');
    expect(years(p('yo'))).toBe('1960–');
  });
  it('fmtDate gives readable dates and keeps the prefixes', () => {
    expect(fmtDate('1896-12-19')).toBe('19 dic 1896');
    expect(fmtDate('1896-02')).toBe('feb 1896');
    expect(fmtDate('c. 1844')).toBe('c. 1844');
    expect(fmtDate('antes de 1938-07-06')).toBe('antes de 6 jul 1938');
    expect(fmtDate('')).toBe('');
  });
  it('yearAt spreads the year by months and days', () => {
    expect(yearAt('1900', 0)).toBe(1900.5);
    expect(yearAt('1900-01-01', 0)).toBe(1900);
    expect(yearAt('1900-07', 0)).toBe(1900.5);
    expect(yearAt('?', 1910)).toBe(1910.5);
  });
  it('hash is stable', () => {
    expect(hash('abc')).toBe(hash('abc'));
    expect(hash('abc')).not.toBe(hash('abd'));
    expect(hash('')).toBe(7);
  });
  it('lightColor: light colors take dark text', () => {
    expect(['#eda100', '#1baf7a', '#e87ba4', '#ffffff'].map(lightColor)).toEqual([true, true, true, true]);
    expect(['#2a78d6', '#eb6834', '#9a958c', '#000000'].map(lightColor)).toEqual([false, false, false, false]);
  });
  it('norm removes accents and capitals', () => {
    expect(norm('José NÚÑEZ Àlex')).toBe('jose nunez alex');
  });
});

describe('splitUrls', () => {
  const urls = (s: string) => splitUrls(s).filter(p => p.url).map(p => p.url);
  it('keeps a text without addresses as it is', () => {
    expect(splitUrls('Archivo parroquial de Villaficticia')).toEqual([{ text: 'Archivo parroquial de Villaficticia' }]);
    expect(splitUrls('')).toEqual([{ text: '' }]);
    expect(urls('ftp://example.org y www.example.org y https://')).toEqual([]);
  });
  it('splits text and addresses, and joins back to the same text', () => {
    const text = 'Copia en https://example.org/a?b=1&c=2 y en http://example.com/x.';
    const parts = splitUrls(text);
    expect(parts.map(p => p.text).join('')).toBe(text);
    expect(parts).toEqual([
      { text: 'Copia en ' }, { text: 'https://example.org/a?b=1&c=2', url: 'https://example.org/a?b=1&c=2' },
      { text: ' y en ' }, { text: 'http://example.com/x', url: 'http://example.com/x' }, { text: '.' },
    ]);
  });
  it('trims the punctuation that closes the sentence', () => {
    expect(urls('Ver https://example.org/a, https://example.org/b; https://example.org/c: fin')).toEqual(
      ['https://example.org/a', 'https://example.org/b', 'https://example.org/c']);
    expect(urls('¿https://example.org/q?')).toEqual(['https://example.org/q']);
    expect(urls('"https://example.org/d".')).toEqual(['https://example.org/d']);
  });
  it('handles brackets and «» quotes', () => {
    expect(urls('(copia: https://example.org/e)')).toEqual(['https://example.org/e']);
    expect(urls('https://example.org/wiki/Villa_(Ficticia)')).toEqual(['https://example.org/wiki/Villa_(Ficticia)']);
    expect(urls('[https://example.org/f]')).toEqual(['https://example.org/f']);
    const parts = splitUrls('«https://example.org/g»');
    expect(parts).toEqual([{ text: '«' }, { text: 'https://example.org/g', url: 'https://example.org/g' }, { text: '»' }]);
  });
});
