import { describe, expect, it } from 'vitest';
import type { Perfil } from '../types/database';
import { descreverCargo, descreverEscopo, primeiroNome } from './perfil';

const TITULOS: Record<string, string> = {
  pres: 'Presidência',
  com: 'Diretoria Comercial',
  proj: 'Diretoria de Projetos',
  adm: 'Diretoria Administrativa',
};
const titulo = (id: string): string => TITULOS[id] ?? id;

function perfil(campos: Partial<Perfil>): Perfil {
  return {
    id: '1', nome: 'Pessoa', email: 'pessoa@facil.test', papel: 'membro',
    area_id: 'com', area_titulo: 'Diretoria Comercial', nucleo_id: null, nucleo_nome: null,
    areas_que_conduz: [], eh_presidencia: false, pode_ajustar_pontos: false,
    pode_cadastrar_pessoas: false, pode_editar_regras: false,
    ...campos,
  };
}

describe('descreverCargo', () => {
  it('mostra a diretoria e as vacâncias cobertas', () => {
    const victor = perfil({ papel: 'diretor', areas_que_conduz: ['com', 'proj'] });
    expect(descreverCargo(victor, titulo)).toBe('Diretoria Comercial · cobre a Diretoria de Projetos');
  });

  it('mostra gerência com o núcleo', () => {
    const duda = perfil({ papel: 'gerente', nucleo_id: 'com-mkt', nucleo_nome: 'Marketing' });
    expect(descreverCargo(duda, titulo)).toBe('Gerência · Marketing');
  });

  it('mostra Presidência sem complemento', () => {
    expect(descreverCargo(perfil({ papel: 'presidente', area_id: 'pres' }), titulo)).toBe('Presidência');
  });
});

describe('descreverEscopo', () => {
  it('lista as áreas conduzidas pela diretoria', () => {
    const victor = perfil({ papel: 'diretor', areas_que_conduz: ['com', 'proj'] });
    expect(descreverEscopo(victor, titulo)).toBe('Vê todos os núcleos de: Diretoria Comercial e Diretoria de Projetos.');
  });

  it('descreve o escopo do membro', () => {
    expect(descreverEscopo(perfil({}), titulo)).toBe('Vê as demandas em que consta como executor.');
  });
});

describe('primeiroNome', () => {
  it('pega só o primeiro nome', () => {
    expect(primeiroNome('  Ana Ferraz ')).toBe('Ana');
  });
});
