import { describe, expect, it } from 'vitest';
import type { SugestaoDoPainel } from '../../types/database';
import {
  contarPorGrupo, descreverApoios, descreverAutoria, estaEmAberto, FILTRO_INICIAL, filtrarSugestoes, nomeDaSituacao, nomeDoTipo,
  validarComentario, validarResposta, validarSugestao,
} from './regras';

const sugestao = (alteracao: Partial<SugestaoDoPainel>): SugestaoDoPainel => ({
  id: 's', tipo: 'melhoria', titulo: 'Título', descricao: 'Descrição', situacao: 'aberta', resposta: null, autor_id: 'a', autor_nome: 'Ana',
  criado_em: '2026-11-05T15:00:00Z', respondido_em: null, respondido_por_nome: null, apoios: 0, apoiei: false, comentarios: 0,
  pode_responder: false, ...alteracao,
});

describe('situações e tipos', () => {
  it('dá nome a cada um e separa em aberto de concluídas', () => {
    expect([nomeDoTipo('bug'), nomeDaSituacao('em_analise'), nomeDaSituacao('feita')]).toEqual(['Bug', 'Em análise', 'Feita']);
    expect(['aberta', 'em_analise', 'planejada', 'feita', 'recusada'].map((s) => estaEmAberto(s as SugestaoDoPainel['situacao'])))
      .toEqual([true, true, true, false, false]);
  });
});

describe('filtrarSugestoes', () => {
  const lista = [
    sugestao({ id: 'velha-apoiada', apoios: 5, criado_em: '2026-10-01T10:00:00Z' }),
    sugestao({ id: 'nova', apoios: 1, criado_em: '2026-11-05T10:00:00Z', tipo: 'bug', titulo: 'Erro no relatório' }),
    sugestao({ id: 'empate-velha', apoios: 1, criado_em: '2026-11-01T10:00:00Z', descricao: 'Ação rápida' }),
    sugestao({ id: 'feita', situacao: 'feita', apoios: 9 }),
  ];

  it('em aberto, das mais apoiadas para as menos; no empate, a mais nova primeiro', () => {
    expect(filtrarSugestoes(lista, FILTRO_INICIAL).map((s) => s.id)).toEqual(['velha-apoiada', 'nova', 'empate-velha']);
  });

  it('concluídas, todas, por tipo e por texto (sem ligar para acento e maiúscula)', () => {
    expect(filtrarSugestoes(lista, { ...FILTRO_INICIAL, grupo: 'concluidas' }).map((s) => s.id)).toEqual(['feita']);
    expect(filtrarSugestoes(lista, { ...FILTRO_INICIAL, grupo: 'todas' }).length).toBe(4);
    expect(filtrarSugestoes(lista, { ...FILTRO_INICIAL, tipo: 'bug' }).map((s) => s.id)).toEqual(['nova']);
    expect(filtrarSugestoes(lista, { ...FILTRO_INICIAL, busca: 'RELATORIO' }).map((s) => s.id)).toEqual(['nova']);
    expect(filtrarSugestoes(lista, { ...FILTRO_INICIAL, busca: 'acao' }).map((s) => s.id)).toEqual(['empate-velha']);
  });

  it('conta por grupo para as abas', () => {
    expect(contarPorGrupo(lista)).toEqual({ em_aberto: 3, concluidas: 1, todas: 4 });
  });

  it('não altera a lista recebida', () => {
    filtrarSugestoes(lista, FILTRO_INICIAL);
    expect(lista.map((s) => s.id)).toEqual(['velha-apoiada', 'nova', 'empate-velha', 'feita']);
  });
});

describe('textos', () => {
  it('autoria e apoios', () => {
    expect(descreverAutoria(sugestao({}))).toBe('Ana · 05/11');
    expect([descreverApoios(0), descreverApoios(1), descreverApoios(3)]).toEqual(['0 apoios', '1 apoio', '3 apoios']);
  });
});

describe('validações', () => {
  const certa = { tipo: 'bug', titulo: 'Erro ao salvar', descricao: 'Aparece erro.' };

  it('sugestão: tipo, título e descrição, com limites', () => {
    expect(validarSugestao(certa)).toBe(null);
    expect(validarSugestao({ ...certa, tipo: 'x' })).toBe('Escolha o tipo da sugestão.');
    expect(validarSugestao({ ...certa, titulo: '  ' })).toBe('Dê um título à sugestão.');
    expect(validarSugestao({ ...certa, titulo: 'x'.repeat(121) })).toBe('O título pode ter até 120 caracteres.');
    expect(validarSugestao({ ...certa, descricao: ' ' })).toBe('Descreva a sugestão.');
    expect(validarSugestao({ ...certa, descricao: 'x'.repeat(2001) })).toBe('A descrição pode ter até 2000 caracteres.');
  });

  it('comentário e resposta', () => {
    expect(validarComentario('Boa ideia')).toBe(null);
    expect(validarComentario('  ')).toBe('Escreva o comentário.');
    expect(validarComentario('x'.repeat(1001))).toBe('O comentário pode ter até 1000 caracteres.');
    expect(validarResposta('planejada', '')).toBe(null);
    expect(validarResposta('pronta', '')).toBe('Escolha a situação.');
    expect(validarResposta('feita', 'x'.repeat(1001))).toBe('A resposta pode ter até 1000 caracteres.');
  });
});
