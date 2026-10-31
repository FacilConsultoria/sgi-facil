import { describe, expect, it } from 'vitest';
import type { AreaDaEstrutura, NucleoDaEstrutura, PessoaDaEquipe } from '../../types/database';
import { descreverFuncao, montarOrganograma, nomeNoRetangulo, ORGANOGRAMA_DESTE_ANO, type NoDoOrganograma } from './organograma-regras';

function pessoa(campos: Partial<PessoaDaEquipe>): PessoaDaEquipe {
  return { id: 'p1', nome: 'Ana', papel: 'membro', area_id: 'com', nucleo_id: 'com-mkt', curso: null, ativo: true, email: null, pode_editar: false, ...campos };
}
function area(campos: Partial<AreaDaEstrutura>): AreaDaEstrutura {
  return { id: 'com', titulo: 'Diretoria Comercial', sigla: 'COM', titular: null, cobertura: null, nota: null, pode_definir_lideranca: false, area_da_presidencia: false, ...campos };
}
function nucleo(campos: Partial<NucleoDaEstrutura>): NucleoDaEstrutura {
  return { id: 'com-mkt', area_id: 'com', nome: 'Marketing', vaga: false, nota: null, ...campos };
}

const areas = [
  area({ id: 'pres', titulo: 'Presidência', titular: 'mel', nota: 'Define a estratégia.', area_da_presidencia: true }),
  area({ id: 'com', titulo: 'Diretoria Comercial', titular: 'joao', nota: 'Prospecção e portfólio.', pode_definir_lideranca: true }),
  area({ id: 'fin', titulo: 'Diretoria Financeira', titular: 'luis', nota: '  Caixa e orçamento.  ' }),
  area({ id: 'proj', titulo: 'Diretoria de Projetos', cobertura: 'joao' }),
];
const nucleos = [
  nucleo({ id: 'pres-ass', area_id: 'pres', nome: 'Assessoria de Presidência', nota: 'Agenda e atas.' }),
  nucleo({ id: 'com-cap', area_id: 'com', nome: 'Captação e clientes', nota: 'Relacionamento com clientes.' }),
  nucleo({ id: 'com-mkt', area_id: 'com', nome: 'Marketing', nota: '   ' }),
  nucleo({ id: 'proj-cli', area_id: 'proj', nome: 'Entregas' }),
];
const pessoas = [
  pessoa({ id: 'mel', nome: 'Mel', papel: 'presidente', area_id: 'pres', nucleo_id: null }),
  pessoa({ id: 'luis', nome: 'Luis', papel: 'vice', area_id: 'pres', nucleo_id: null }),
  pessoa({ id: 'joao', nome: 'João', papel: 'diretor', nucleo_id: null }),
  pessoa({ id: 'maju', nome: 'Maju', papel: 'assessor', area_id: 'pres', nucleo_id: 'pres-ass' }),
  pessoa({ id: 'emilli', nome: 'Emilli', papel: 'gerente', nucleo_id: 'com-cap' }),
  pessoa({ id: 'duda', nome: 'Duda', papel: 'gerente' }),
  pessoa({ id: 'ana', nome: 'Ana', nucleo_id: 'com-mkt' }),
  pessoa({ id: 'victor', nome: 'Victor', papel: 'gerente', area_id: 'proj', nucleo_id: 'proj-cli' }),
];

const titulos = (no: NoDoOrganograma): unknown => (no.filhos.length ? [no.titulo, no.filhos.map(titulos)] : no.titulo);

describe('organograma deste ano', () => {
  it('tem só os seis cargos pedidos, nesta hierarquia', () => {
    expect(titulos(montarOrganograma(ORGANOGRAMA_DESTE_ANO, areas, nucleos, pessoas))).toEqual(
      ['Presidência', ['Vice-presidência', 'Assessoria de Presidência', ['Diretor Comercial', ['Gerente Comercial', 'Marketing']]]]);
  });

  it('põe a pessoa certa em cada cargo', () => {
    const raiz = montarOrganograma(ORGANOGRAMA_DESTE_ANO, areas, nucleos, pessoas);
    const [vice, assessoria, comercial] = raiz.filhos;
    const [gerente, marketing] = comercial?.filhos ?? [];
    expect([raiz, vice, assessoria, comercial, gerente, marketing].map((no) => no?.pessoa?.nome)).toEqual(['Mel', 'Luis', 'Maju', 'João', 'Emilli', 'Duda']);
  });

  it('a função vem da nota da área ou do núcleo, sem espaços sobrando', () => {
    const raiz = montarOrganograma(ORGANOGRAMA_DESTE_ANO, areas, nucleos, pessoas);
    const [vice, assessoria, comercial] = raiz.filhos;
    const [gerente, marketing] = comercial?.filhos ?? [];
    expect([raiz, vice, assessoria, comercial, gerente, marketing].map((no) => no?.funcao)).toEqual([
      'Define a estratégia.', 'Caixa e orçamento.', 'Agenda e atas.', 'Prospecção e portfólio.', 'Relacionamento com clientes.', null]);
  });

  it('só os cargos de titular de área levam a área (para definir a liderança)', () => {
    const raiz = montarOrganograma(ORGANOGRAMA_DESTE_ANO, areas, nucleos, pessoas);
    const [vice, assessoria, comercial] = raiz.filhos;
    expect([raiz.area?.id, vice?.area, assessoria?.area, comercial?.area?.id, comercial?.area?.pode_definir_lideranca]).toEqual(['pres', null, null, 'com', true]);
  });

  it('cargo sem pessoa fica sem pessoa; pessoa desativada não conta', () => {
    const semGerente = pessoas.map((p) => (p.id === 'emilli' ? { ...p, ativo: false } : p));
    const raiz = montarOrganograma(ORGANOGRAMA_DESTE_ANO, areas, nucleos, semGerente);
    expect(raiz.filhos[2]?.filhos[0]?.pessoa).toBe(null);
    const semTitular = areas.map((a) => (a.id === 'com' ? { ...a, titular: null } : a));
    expect(montarOrganograma(ORGANOGRAMA_DESTE_ANO, semTitular, nucleos, pessoas).filhos[2]?.pessoa).toBe(null);
  });

  it('não mostra membros, só os cargos', () => {
    const todos = JSON.stringify(montarOrganograma(ORGANOGRAMA_DESTE_ANO, areas, nucleos, pessoas));
    expect(todos.includes('"Ana"')).toBe(false);
    expect(todos.includes('"Victor"')).toBe(false);
  });
});

describe('textos do retângulo e da janela', () => {
  const comPessoa = { pessoa: pessoa({ id: 'mel', nome: 'Mel' }) };

  it('mostra o nome, marca a própria pessoa e avisa quando o cargo está sem ninguém', () => {
    expect(nomeNoRetangulo(comPessoa, 'outra')).toBe('Mel');
    expect(nomeNoRetangulo(comPessoa, 'mel')).toBe('Mel (você)');
    expect(nomeNoRetangulo({ pessoa: null }, 'mel')).toBe('A definir');
  });

  it('descreve a função ou avisa que ainda não há texto', () => {
    expect(descreverFuncao({ funcao: 'Define a estratégia.' })).toBe('Define a estratégia.');
    expect(descreverFuncao({ funcao: null })).toBe('A função deste cargo ainda não foi descrita.');
  });
});
