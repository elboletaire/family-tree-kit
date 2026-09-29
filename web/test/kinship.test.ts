import { beforeEach, describe, expect, it } from 'vitest';
import { initData, P } from '../src/data';
import { ancestors, bloodLabel, kinship, parentsOf, stepSiblings } from '../src/kinship';
import { fixture } from './fixture';

beforeEach(() => initData(fixture()));

describe('kinship', () => {
  it('siblings without parents share a virtual parent', () => {
    expect(parentsOf('suelto1')).toEqual(['~suelto1']);
    expect(parentsOf('suelto2')).toEqual(['~suelto1']);
    expect(parentsOf('yo')).toEqual(['padre', 'madre']);
  });
  it('ancestors counts generations', () => {
    expect(Object.fromEntries(ancestors('yo'))).toEqual({ yo: 0, padre: 1, madre: 1, abuelo: 2, abuela: 2 });
  });
  it('blood labels by sex and distance', () => {
    const hermana = P.get('hermana')!, primo = P.get('primo')!;
    expect(bloodLabel(hermana, { a: 1, b: 1 })).toBe('hermana');
    expect(bloodLabel(primo, { a: 2, b: 2 })).toBe('primo hermano');
    expect(bloodLabel(primo, { a: 3, b: 3 })).toBe('primo segundo');
    expect(bloodLabel(hermana, { a: 2, b: 0 })).toBe('abuela');
    expect(bloodLabel(primo, { a: 0, b: 2 })).toBe('nieto');
    expect(bloodLabel(primo, { a: 1, b: 2 })).toBe('sobrino');
    expect(bloodLabel(hermana, { a: 2, b: 1 })).toBe('tía');
    expect(bloodLabel(primo, { a: 7, b: 0 })).toBe('antepasado (7 generaciones)');
  });
  it('kinship gathers blood and in-law relations', () => {
    const k = kinship('yo');
    const label = (id: string) => k.get(id)?.label;
    expect(k.get('yo')).toEqual({ label: '', kind: 'self' });
    expect(k.get('padre')).toEqual({ label: 'padre', kind: 'direct' });
    expect(k.get('abuela')).toEqual({ label: 'abuela', kind: 'direct' });
    expect(k.get('hermana')).toEqual({ label: 'hermana', kind: 'blood' });
    expect(label('tia')).toBe('tía');
    expect(label('primo')).toBe('primo hermano');
    expect(k.get('hermanastro')).toEqual({ label: 'hermanastro', kind: 'inLaw' });
    expect(label('tio')).toBe('cónyuge de su tía');
    expect(label('segunda')).toBe('cónyuge de su padre');
    expect(k.has('suelto1')).toBe(false);
  });
  it('parents- and siblings-in-law, from the spouse', () => {
    const k = kinship('madre');
    expect(k.get('padre')?.label).toBe('cónyuge');
    expect(k.get('abuelo')?.label).toBe('suegro');
    expect(k.get('tia')?.label).toBe('cuñada');
    expect(k.get('yo')?.kind).toBe('direct');
  });
  it('children of couples after a broken union are not step-siblings', () => {
    // padre and madre marry in 1955; then padre has hermanastro (with segunda) and madre has medio (with otro)
    const withMedio = (born: number, bornStep: number) => {
      const d = fixture();
      const get = (id: string) => d.people.find(p => p.id === id)!;
      Object.assign(get('hermanastro'), { father: 'padre', bornYear: bornStep });
      get('padre').children.push('hermanastro');
      get('madre').spouses.push('otro');
      get('madre').children.push('medio');
      d.people.push({ ...get('tio'), id: 'otro', spouses: ['madre'], children: ['medio'] },
                    { ...get('primo'), id: 'medio', father: 'otro', mother: 'madre', bornYear: born });
      initData(d);
    };
    withMedio(1972, 1970);
    expect(stepSiblings('medio', 'hermanastro')).toBe(false);
    expect(kinship('hermanastro').has('medio')).toBe(false);
    expect(kinship('yo').get('medio')?.label).toBe('hermano');
    // If both were born before the wedding, they are
    withMedio(1950, 1952);
    expect(stepSiblings('hermanastro', 'medio')).toBe(true);
  });
});
