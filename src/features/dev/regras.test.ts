import { describe, expect, it } from 'vitest';
import { cargoAtual, opcoesDeCargo, valorDoCargo } from './regras';

const AREAS = [
  { id: 'pres', titulo: 'Presidência' }, { id: 'fin', titulo: 'Diretoria Financeira' }, { id: 'com', titulo: 'Diretoria Comercial' },
];
const NUCLEOS = [
  { id: 'com-mkt', nome: 'Marketing', area_id: 'com' }, { id: 'pres-ass', nome: 'Assessoria de Presidência', area_id: 'pres' },
  { id: 'com-cap', nome: 'Captação e clientes', area_id: 'com' },
];

describe('opcoesDeCargo', () => {
  const opcoes = opcoesDeCargo(AREAS, NUCLEOS);

  it('lista Presidência, Vice, assessoria da Presidência, diretorias, gerências e membros, em ordem', () => {
    expect(opcoes.map((o) => [o.grupo, o.rotulo])).toEqual([
      ['Presidência', 'Presidência'],
      ['Presidência', 'Vice-Presidência'],
      ['Presidência', 'Assessoria · Assessoria de Presidência'],
      ['Diretorias', 'Diretoria Comercial'],
      ['Diretorias', 'Diretoria Financeira'],
      ['Gerências', 'Gerência · Assessoria de Presidência'],
      ['Gerências', 'Gerência · Captação e clientes'],
      ['Gerências', 'Gerência · Marketing'],
      ['Membros', 'Membro · Assessoria de Presidência'],
      ['Membros', 'Membro · Captação e clientes'],
      ['Membros', 'Membro · Marketing'],
    ]);
  });

  it('cada opção leva o que o banco precisa: área para diretoria, núcleo para os cargos de núcleo', () => {
    const resumo = (rotulo: string): unknown => {
      const o = opcoes.find((x) => x.rotulo === rotulo);
      return o ? [o.papel, o.area, o.nucleo, o.valor] : null;
    };
    expect(resumo('Diretoria Comercial')).toEqual(['diretor', 'com', null, 'diretor|com|']);
    expect(resumo('Membro · Marketing')).toEqual(['membro', null, 'com-mkt', 'membro||com-mkt']);
  });

  it('os valores não se repetem', () => {
    expect(new Set(opcoes.map((o) => o.valor)).size).toBe(opcoes.length);
  });
});

describe('cargoAtual', () => {
  it('acha a opção do cargo de agora', () => {
    expect(cargoAtual({ papel: 'presidente', area_id: 'pres', nucleo_id: null })).toBe('presidente||');
    expect(cargoAtual({ papel: 'vice', area_id: 'pres', nucleo_id: null })).toBe('vice||');
    expect(cargoAtual({ papel: 'diretor', area_id: 'com', nucleo_id: null })).toBe('diretor|com|');
    expect(cargoAtual({ papel: 'gerente', area_id: 'com', nucleo_id: 'com-mkt' })).toBe('gerente||com-mkt');
    expect(cargoAtual({ papel: 'membro', area_id: 'com', nucleo_id: 'com-mkt' })).toBe(valorDoCargo({ papel: 'membro', area: null, nucleo: 'com-mkt' }));
  });
});
