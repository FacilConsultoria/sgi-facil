import { describe, expect, it } from 'vitest';
import type { AreaDaEstrutura, PessoaDaEquipe } from '../../types/database';
import {
  descreverFuncao, medirOrganograma, montarOrganograma, nomeNoRetangulo, ORGANOGRAMA_DESTE_ANO, type CargoDoOrganograma, type NoDoOrganograma,
} from './organograma-regras';

function pessoa(campos: Partial<PessoaDaEquipe>): PessoaDaEquipe {
  return { id: 'p1', nome: 'Ana', papel: 'membro', area_id: 'com', nucleo_id: 'com-mkt', curso: null, ativo: true, email: null, pode_editar: false, ...campos };
}
function area(campos: Partial<AreaDaEstrutura>): AreaDaEstrutura {
  return { id: 'com', titulo: 'Diretoria Comercial', sigla: 'COM', titular: null, cobertura: null, nota: null, pode_definir_lideranca: false, area_da_presidencia: false, ...campos };
}

const areas = [
  area({ id: 'pres', titulo: 'Presidência', titular: 'mel', area_da_presidencia: true }),
  area({ id: 'com', titulo: 'Diretoria Comercial', titular: 'joao', nota: 'Texto antigo da área.', pode_definir_lideranca: true }),
  area({ id: 'proj', titulo: 'Diretoria de Projetos', cobertura: 'joao' }),
];
const pessoas = [
  pessoa({ id: 'mel', nome: 'Mel', papel: 'presidente', area_id: 'pres', nucleo_id: null }),
  pessoa({ id: 'luis', nome: 'Luis', papel: 'vice', area_id: 'pres', nucleo_id: null }),
  pessoa({ id: 'joao', nome: 'João', papel: 'diretor', nucleo_id: null }),
  pessoa({ id: 'maju', nome: 'Maju', papel: 'assessor', area_id: 'pres', nucleo_id: 'pres-ass' }),
  pessoa({ id: 'emilli', nome: 'Emilli', papel: 'gerente', nucleo_id: 'com-cap' }),
  pessoa({ id: 'victor', nome: 'Victor', papel: 'gerente', area_id: 'proj', nucleo_id: 'proj-cli' }),
  pessoa({ id: 'duda', nome: 'Duda', papel: 'gerente' }),
  pessoa({ id: 'ana', nome: 'Ana', nucleo_id: 'com-mkt' }),
];
const montar = (lista = pessoas, listaDeAreas = areas): NoDoOrganograma => montarOrganograma(ORGANOGRAMA_DESTE_ANO, listaDeAreas, lista);

const titulos = (no: NoDoOrganograma): unknown => (no.filhos.length ? [no.titulo, no.filhos.map(titulos)] : no.titulo);
const todos = (no: NoDoOrganograma): NoDoOrganograma[] => [no, ...no.filhos.flatMap(todos)];

describe('organograma deste ano', () => {
  it('tem só os cargos pedidos, nesta hierarquia, com os dois gerentes comerciais', () => {
    expect(titulos(montar())).toEqual(
      ['Presidência', ['Vice-presidência', 'Assessoria de Presidência', ['Diretor Comercial', ['Gerente Comercial', 'Gerente Comercial', 'Marketing']]]]);
  });

  it('põe a pessoa certa em cada cargo, com Victor entre os gerentes comerciais', () => {
    expect(todos(montar()).map((no) => no.pessoa?.nome)).toEqual(['Mel', 'Luis', 'Maju', 'João', 'Emilli', 'Victor', 'Duda']);
  });

  it('só os cargos de titular de área levam a área (para definir a liderança)', () => {
    const [raiz, vice, assessoria, comercial] = todos(montar());
    expect([raiz?.area?.id, vice?.area, assessoria?.area, comercial?.area?.id, comercial?.area?.pode_definir_lideranca]).toEqual(['pres', null, null, 'com', true]);
  });

  it('cargo sem pessoa fica sem pessoa; pessoa desativada não conta', () => {
    const semVictor = pessoas.map((p) => (p.id === 'victor' ? { ...p, ativo: false } : p));
    expect(todos(montar(semVictor)).map((no) => no.pessoa?.nome ?? null)).toEqual(['Mel', 'Luis', 'Maju', 'João', 'Emilli', null, 'Duda']);
    const semTitular = areas.map((a) => (a.id === 'com' ? { ...a, titular: null } : a));
    expect(todos(montar(pessoas, semTitular))[3]?.pessoa).toBe(null);
  });

  it('não mostra membros, só os cargos', () => {
    expect(JSON.stringify(montar()).includes('"Ana"')).toBe(false);
  });

  it('não usa o texto antigo da área: a função fica por definir', () => {
    expect(todos(montar()).map((no) => no.funcao)).toEqual([null, null, null, null, null, null, null]);
  });

  it('usa o texto da função quando a tabela de cargos o traz', () => {
    const cargo: CargoDoOrganograma = { id: 'x', titulo: 'X', pessoa: { papel: 'vice' }, funcao: '  Cuida das finanças.  ' };
    expect(montarOrganograma(cargo, areas, pessoas).funcao).toBe('Cuida das finanças.');
    expect(montarOrganograma({ ...cargo, funcao: '   ' }, areas, pessoas).funcao).toBe(null);
  });
});

describe('medidas do desenho', () => {
  const medidas = medirOrganograma(montar());

  it('conta as folhas e as colunas do nível mais cheio', () => {
    expect(medidas.folhas).toBe(5);
    expect(medidas.colunas).toBe(3);
  });

  it('põe cada cargo no seu nível e coluna; a Presidência, sozinha, fica no meio', () => {
    const posicao = (id: string) => medidas.posicoes.get(id);
    expect([posicao('presidencia')?.nivel, posicao('presidencia')?.coluna, posicao('presidencia')?.lugar]).toEqual([1, 2, 'unico']);
    expect(['vice', 'assessoria', 'comercial'].map((id) => [posicao(id)?.nivel, posicao(id)?.coluna, posicao(id)?.lugar])).toEqual([
      [2, 1, 'primeiro'], [2, 2, 'meio'], [2, 3, 'ultimo']]);
    expect(['gerente-comercial-captacao', 'gerente-comercial-entregas', 'marketing'].map((id) => [posicao(id)?.nivel, posicao(id)?.coluna, posicao(id)?.lugar])).toEqual([
      [3, 1, 'primeiro'], [3, 2, 'meio'], [3, 3, 'ultimo']]);
  });

  it('marca quem tem cargos abaixo', () => {
    expect(['presidencia', 'vice', 'comercial', 'marketing'].map((id) => medidas.posicoes.get(id)?.temFilhos)).toEqual([true, false, true, false]);
  });
});

describe('textos do retângulo e da janela', () => {
  const comPessoa = { pessoa: pessoa({ id: 'mel', nome: 'Mel' }) };

  it('mostra o nome, marca a própria pessoa e avisa quando o cargo está sem ninguém', () => {
    expect(nomeNoRetangulo(comPessoa, 'outra')).toBe('Mel');
    expect(nomeNoRetangulo(comPessoa, 'mel')).toBe('Mel (você)');
    expect(nomeNoRetangulo({ pessoa: null }, 'mel')).toBe('A definir');
  });

  it('mostra a função ou "A definir" enquanto não há texto', () => {
    expect(descreverFuncao({ funcao: 'Define a estratégia.' })).toBe('Define a estratégia.');
    expect(descreverFuncao({ funcao: null })).toBe('A definir.');
  });
});
