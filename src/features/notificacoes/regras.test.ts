import { describe, expect, it } from 'vitest';
import type { Notificacao } from '../../types/database';
import { descreverAtraso, descreverNotificacao, idsParaMarcar, ordenarNotificacoes, rotuloDoSino, textoDoContador } from './regras';

const HOJE = '2026-11-10';

const notificacao = (alteracao: Partial<Notificacao>): Notificacao => ({
  chave: 'k', id: null, tipo: 'atraso', titulo: 'Relatório', codigo: 'COM-001', prazo: '2026-11-05', autor_nome: null, demanda_id: 'd', recado_id: null,
  em: '2026-11-05T00:00:00Z', ...alteracao,
});

describe('contador do sino', () => {
  it('mostra o número e, de cem para cima, 99+', () => {
    expect(textoDoContador(1)).toBe('1');
    expect(textoDoContador(99)).toBe('99');
    expect(textoDoContador(100)).toBe('99+');
  });

  it('dá nome ao botão para leitores de tela', () => {
    expect(rotuloDoSino(0)).toBe('Notificações: nenhuma nova');
    expect(rotuloDoSino(1)).toBe('Notificações: 1 nova');
    expect(rotuloDoSino(4)).toBe('Notificações: 4 novas');
  });
});

describe('ordenarNotificacoes', () => {
  it('põe os atrasos primeiro (o mais antigo no topo) e depois o que chegou, do mais recente para trás', () => {
    const lista = [
      notificacao({ chave: 'recado-velho', tipo: 'recado', id: 'a', em: '2026-11-08T10:00:00Z', prazo: null, codigo: null }),
      notificacao({ chave: 'atraso-novo', prazo: '2026-11-09', codigo: 'COM-002' }),
      notificacao({ chave: 'atribuicao', tipo: 'atribuicao', id: 'b', em: '2026-11-09T10:00:00Z', prazo: '2026-11-20' }),
      notificacao({ chave: 'atraso-velho', prazo: '2026-11-01', codigo: 'COM-003' }),
    ];
    expect(ordenarNotificacoes(lista).map((n) => n.chave)).toEqual(['atraso-velho', 'atraso-novo', 'atribuicao', 'recado-velho']);
  });

  it('não altera a lista recebida', () => {
    const original = [notificacao({ chave: 'b', prazo: '2026-11-09' }), notificacao({ chave: 'a', prazo: '2026-11-01' })];
    ordenarNotificacoes(original);
    expect(original.map((n) => n.chave)).toEqual(['b', 'a']);
  });
});

describe('descreverAtraso', () => {
  it('fala de ontem e de quantos dias', () => {
    expect(descreverAtraso('2026-11-09', HOJE)).toBe('Venceu ontem · 09/11');
    expect(descreverAtraso('2026-11-05', HOJE)).toBe('Atrasada há 5 dias · 05/11');
  });
});

describe('descreverNotificacao', () => {
  it('atraso: código, título e há quantos dias', () => {
    expect(descreverNotificacao(notificacao({}), HOJE)).toEqual({ titulo: 'COM-001 · Relatório', detalhe: 'Atrasada há 5 dias · 05/11' });
  });

  it('atribuição: avisa o prazo', () => {
    expect(descreverNotificacao(notificacao({ tipo: 'atribuicao', prazo: '2026-11-20' }), HOJE))
      .toEqual({ titulo: 'COM-001 · Relatório', detalhe: 'Atribuída a você · prazo 20/11' });
  });

  it('recado: título e quem enviou, sem código', () => {
    expect(descreverNotificacao(notificacao({ tipo: 'recado', titulo: 'Reunião adiada', codigo: null, prazo: null, autor_nome: 'Mel' }), HOJE))
      .toEqual({ titulo: 'Reunião adiada', detalhe: 'Recado de Mel' });
  });
});

describe('pedido de autorização no sino', () => {
  it('título do recado, quem pediu e o rótulo "Autorizar"; sai sozinho (sem id para marcar)', () => {
    const pedido = notificacao({ tipo: 'autorizacao', titulo: 'Feira de profissões', codigo: null, prazo: null, autor_nome: 'João', recado_id: 'r', demanda_id: null });
    expect(descreverNotificacao(pedido, HOJE)).toEqual({ titulo: 'Feira de profissões', detalhe: 'Recado para toda a equipe pedido por João' });
    expect(idsParaMarcar([pedido])).toEqual([]);
  });
});

describe('idsParaMarcar', () => {
  it('leva só as que têm id gravado (atrasos não têm)', () => {
    expect(idsParaMarcar([notificacao({ id: null }), notificacao({ id: 'x', tipo: 'recado' }), notificacao({ id: 'y', tipo: 'atribuicao' })])).toEqual(['x', 'y']);
  });
});
