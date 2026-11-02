import { describe, expect, it } from 'vitest';
import type { AreaDaEstrutura, LinhaDaSimulacao } from '../../types/database';
import {
  descreverQuantidade, introducaoDaSimulacao, passosDaExcecao, perfisDeAcesso, situacaoDasAreas,
  validarRegrasDePontos, valoresParaOsCampos, type ValoresDigitados,
} from './regras';

const valores = (alteracao: Partial<ValoresDigitados> = {}): ValoresDigitados => ({
  pontos_iniciais: '10', entrega_no_prazo: '2', entrega_atrasada: '1', falta: '-2', falta_justificada: '0', ...alteracao,
});

describe('validarRegrasDePontos', () => {
  it('aceita inteiros de −50 a 50, inclusive negativos e zero', () => {
    expect(validarRegrasDePontos(valores())).toBe(null);
    expect(validarRegrasDePontos(valores({ falta: '-50', pontos_iniciais: '50' }))).toBe(null);
  });

  it('recusa vazio, decimal, texto e fora do intervalo com a mensagem do banco', () => {
    const mensagem = 'Use números inteiros entre −50 e 50.';
    expect(validarRegrasDePontos(valores({ falta: '' }))).toBe(mensagem);
    expect(validarRegrasDePontos(valores({ falta: '  ' }))).toBe(mensagem);
    expect(validarRegrasDePontos(valores({ entrega_no_prazo: '1.5' }))).toBe(mensagem);
    expect(validarRegrasDePontos(valores({ entrega_atrasada: 'abc' }))).toBe(mensagem);
    expect(validarRegrasDePontos(valores({ pontos_iniciais: '51' }))).toBe(mensagem);
    expect(validarRegrasDePontos(valores({ falta: '-51' }))).toBe(mensagem);
  });
});

describe('valoresParaOsCampos', () => {
  it('converte os números da configuração em texto de campo', () => {
    expect(valoresParaOsCampos({
      pontos_iniciais: 10, entrega_no_prazo: 2, entrega_atrasada: 1, falta: -2, falta_justificada: 0, ranking_publico: true,
    })).toEqual(valores());
  });
});

describe('quadro de permissões', () => {
  it('tem os seis perfis, do mais amplo ao mais restrito, sem campo vazio', () => {
    expect(perfisDeAcesso().map((perfil) => perfil.perfil)).toEqual([
      'Presidente', 'Vice-Presidente', 'Assessoria de Presidência', 'Diretoria', 'Gerência', 'Membro',
    ]);
    for (const perfil of perfisDeAcesso()) {
      for (const texto of Object.values(perfil)) expect(texto.trim() === '').toBe(false);
    }
  });

  it('descreve a exceção em cinco passos', () => {
    expect(passosDaExcecao().length).toBe(5);
  });
});

describe('situacaoDasAreas', () => {
  const area = (alteracao: Partial<AreaDaEstrutura>): AreaDaEstrutura => ({
    id: 'x', titulo: 'Área', sigla: 'X', titular: null, cobertura: null, nota: null,
    pode_definir_lideranca: false, area_da_presidencia: false, ...alteracao,
  });
  const nomes: Record<string, string> = { a: 'Ana', b: 'Bia' };
  const nomeDe = (id: string): string | undefined => nomes[id];

  it('mostra o titular, ou a cobertura de uma vaga, ou só a vaga', () => {
    const linhas = situacaoDasAreas([
      area({ id: 'c', titulo: 'Comercial', titular: 'a' }),
      area({ id: 'f', titulo: 'Financeiro', cobertura: 'b' }),
      area({ id: 'p', titulo: 'Projetos' }),
    ], nomeDe);
    expect(linhas.map((linha) => linha.responsavel)).toEqual(['Ana', 'Vaga · coberta por Bia', 'Vaga']);
    expect(linhas.map((linha) => linha.vaga)).toEqual([false, true, true]);
  });

  it('põe a Presidência primeiro e ordena o resto pelo título', () => {
    const linhas = situacaoDasAreas([
      area({ id: 'p', titulo: 'Projetos' }),
      area({ id: 'a', titulo: 'Administrativo' }),
      area({ id: 'pres', titulo: 'Presidência', area_da_presidencia: true }),
    ], nomeDe);
    expect(linhas.map((linha) => linha.id)).toEqual(['pres', 'a', 'p']);
  });

  it('trata id de pessoa desconhecido como vaga', () => {
    expect(situacaoDasAreas([area({ titular: 'z' })], nomeDe)[0]?.responsavel).toBe('Vaga');
  });
});

describe('simulação', () => {
  it('mostra – quando não há nenhuma', () => {
    expect(descreverQuantidade(0)).toBe('–');
    expect(descreverQuantidade(3)).toBe('3');
  });

  it('cita o total de demandas na introdução', () => {
    const linha: LinhaDaSimulacao = {
      pessoa_id: 'a', nome: 'Ana', papel: 'membro', setor: 'Marketing',
      demandas_visiveis: 1, por_excecao: 0, pontuacoes_visiveis: 1, total_demandas: 12,
    };
    expect(introducaoDaSimulacao([linha]).includes('12 demandas')).toBe(true);
    expect(introducaoDaSimulacao([]).includes('0 demandas')).toBe(true);
  });
});
