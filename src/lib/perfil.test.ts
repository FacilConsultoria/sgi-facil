import { describe, expect, it } from 'vitest';
import type { Perfil } from '../types/database';
import { descreverCargo, descreverEscopo, primeiroNome } from './perfil';

const TITULOS: Record<string, string> = {
  pres: 'Presidência',
  com: 'Diretoria Comercial',
  proj: 'Diretoria de Projetos',
  adm: 'Diretoria Administrativa',
  fin: 'Diretoria Financeira',
};
const titulo = (id: string): string => TITULOS[id] ?? id;

function perfil(campos: Partial<Perfil>): Perfil {
  return {
    id: '1', nome: 'Pessoa', email: 'pessoa@facil.test', papel: 'membro',
    area_id: 'com', area_titulo: 'Diretoria Comercial', nucleo_id: null, nucleo_nome: null,
    areas_que_conduz: [], eh_presidencia: false, eh_presidente: false, pode_ajustar_pontos: false,
    pode_cadastrar_pessoas: false, pode_editar_regras: false, dados_pendentes: false,
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

  it('mostra a Vice-Presidência com a diretoria que acumula', () => {
    const luis = perfil({ papel: 'vice', area_id: 'pres', areas_que_conduz: ['fin'] });
    expect(descreverCargo(luis, titulo)).toBe('Vice-Presidência · Diretoria Financeira');
  });
});

describe('descreverEscopo', () => {
  it('lista as áreas conduzidas pela diretoria', () => {
    const victor = perfil({ papel: 'diretor', areas_que_conduz: ['com', 'proj'] });
    expect(descreverEscopo(victor, titulo)).toBe('Vê todos os núcleos de: Diretoria Comercial e Diretoria de Projetos.');
  });

  it('dá à Vice-Presidência o mesmo escopo da Presidência', () => {
    expect(descreverEscopo(perfil({ papel: 'vice', areas_que_conduz: ['fin'] }), titulo)).toBe(
      'Acesso irrestrito a todas as diretorias, projetos e relatórios.',
    );
  });

  it('descreve a Assessoria de Presidência com acesso de Presidência e os avais', () => {
    const maju = perfil({ papel: 'assessor', area_id: 'pres', eh_presidencia: true });
    expect(descreverEscopo(maju, titulo)).toBe(
      'Mesmo acesso da Presidência. Ajustar a própria pontuação e aprovar acessos por exceção dependem de aval da Presidência ou da Vice-Presidência.',
    );
    expect(descreverEscopo(perfil({ papel: 'assessor' }), titulo)).toBe('Organiza agenda e atas das reuniões gerais e da Presidência.');
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
