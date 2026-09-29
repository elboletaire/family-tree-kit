import { describe, expect, it } from 'vitest';
import { esc, fmtDate, hash, initials, lifespan, lightColor, norm, years, yearAt } from '../src/util';
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
