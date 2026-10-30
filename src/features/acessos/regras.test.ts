import { describe, expect, it } from 'vitest';
import type { SolicitacaoVisivel } from '../../types/database';
import {
  descreverValidade, limitesDaValidade, resumoDoPedidoDeAvalDeDecisao, separarSolicitacoes, tituloDoPedido, validarPedidoDeAcesso,
} from './regras';

function solicitacao(campos: Partial<SolicitacaoVisivel>): SolicitacaoVisivel {
  return {
    id: 's1', solicitante: 'u1', beneficiario: 'u2', alvo: 'projeto', projeto_id: 'p1', demanda_id: null,
    justificativa: 'Vou apoiar a estimativa de custos do projeto', valido_ate: '2026-11-30', status: 'pendente',
    decidido_por: null, decidido_em: null, nota: null, revogado_por: null, revogado_em: null, criado_em: '2026-10-30T12:00:00Z',
    situacao: 'pendente', area_id: 'proj', alvo_restrito: false, pode_aprovar: false, pode_revogar: false,
    alvo_nome: 'Mapeamento · Padaria', pode_pedir_aval: false,
    ...campos,
  };
}

describe('separarSolicitacoes', () => {
  it('separa o que se decide, o que está pendente, o vigente e o encerrado', () => {
    const lista = [
      solicitacao({ id: 'a', pode_aprovar: true, criado_em: '2026-10-30T15:00:00Z' }),
      solicitacao({ id: 'b', pode_aprovar: true, criado_em: '2026-10-29T10:00:00Z' }),
      solicitacao({ id: 'c', pode_pedir_aval: true }),
      solicitacao({ id: 'd' }),
      solicitacao({ id: 'e', status: 'aprovada', situacao: 'aprovada', valido_ate: '2026-12-01' }),
      solicitacao({ id: 'f', status: 'aprovada', situacao: 'aprovada', valido_ate: '2026-11-10' }),
      solicitacao({ id: 'g', status: 'negada', situacao: 'negada', decidido_em: '2026-10-28T10:00:00Z' }),
      solicitacao({ id: 'h', status: 'aprovada', situacao: 'revogada', revogado_em: '2026-10-30T09:00:00Z' }),
      solicitacao({ id: 'i', status: 'aprovada', situacao: 'expirada', decidido_em: '2026-09-01T09:00:00Z' }),
    ];
    const grupos = separarSolicitacoes(lista);
    expect(grupos.paraDecidir.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(grupos.pendentes.map((s) => s.id)).toEqual(['d']);
    expect(grupos.vigentes.map((s) => s.id)).toEqual(['f', 'e']);
    expect(grupos.encerrados.map((s) => s.id)).toEqual(['h', 'g', 'i']);
  });
});

describe('validade', () => {
  it('descreve a validade conforme a situação', () => {
    expect(descreverValidade({ valido_ate: '2026-11-30', situacao: 'pendente' })).toBe('Validade pedida: até 30/11/2026');
    expect(descreverValidade({ valido_ate: '2026-11-30', situacao: 'aprovada' })).toBe('Válido até 30/11/2026');
  });

  it('limita de amanhã a 90 dias, com 30 de padrão', () => {
    expect(limitesDaValidade('2026-10-30')).toEqual({ minimo: '2026-10-31', padrao: '2026-11-29', maximo: '2027-01-28' });
  });
});

describe('validarPedidoDeAcesso', () => {
  const hoje = '2026-10-30';
  const base = { beneficiario: 'u2', alvo: 'projeto' as const, projeto: 'p1', codigo: '', justificativa: 'Vou apoiar a estimativa de custos do projeto', validade: '2026-11-15' };

  it('aceita um pedido completo', () => {
    expect(validarPedidoDeAcesso(base, hoje)).toBe(null);
    expect(validarPedidoDeAcesso({ ...base, alvo: 'demanda', projeto: '', codigo: 'PRJ-001' }, hoje)).toBe(null);
  });

  it('confere cada campo na ordem do banco', () => {
    expect(validarPedidoDeAcesso({ ...base, beneficiario: '' }, hoje)).toBe('Escolha para quem é o acesso.');
    expect(validarPedidoDeAcesso({ ...base, projeto: '' }, hoje)).toBe('Escolha um projeto da lista.');
    expect(validarPedidoDeAcesso({ ...base, alvo: 'demanda', projeto: '', codigo: '  ' }, hoje)).toBe('Informe o código da demanda, como PRJ-001.');
    expect(validarPedidoDeAcesso({ ...base, justificativa: 'curta demais' }, hoje)).toBe('Escreva uma justificativa com pelo menos 20 caracteres.');
  });

  it('recusa validade fora de amanhã a 90 dias', () => {
    const mensagem = 'Escolha uma validade entre amanhã e 90 dias.';
    expect(validarPedidoDeAcesso({ ...base, validade: '' }, hoje)).toBe(mensagem);
    expect(validarPedidoDeAcesso({ ...base, validade: '2026-10-30' }, hoje)).toBe(mensagem);
    expect(validarPedidoDeAcesso({ ...base, validade: '2026-10-31' }, hoje)).toBe(null);
    expect(validarPedidoDeAcesso({ ...base, validade: '2027-01-28' }, hoje)).toBe(null);
    expect(validarPedidoDeAcesso({ ...base, validade: '2027-01-29' }, hoje)).toBe(mensagem);
  });
});

describe('textos', () => {
  it('monta o título do pedido', () => {
    expect(tituloDoPedido('Ana Ferraz', 'Mapeamento · Padaria')).toBe('Ana Ferraz → Mapeamento · Padaria');
  });

  it('monta o resumo do pedido de aval, com a observação quando houver', () => {
    expect(resumoDoPedidoDeAvalDeDecisao(true, 'Ana', 'Mapeamento', ' Só consulta ')).toBe('Aprovar o acesso por exceção de Ana a Mapeamento: Só consulta');
    expect(resumoDoPedidoDeAvalDeDecisao(false, 'Ana', 'Mapeamento', '')).toBe('Negar o acesso por exceção de Ana a Mapeamento');
    expect(resumoDoPedidoDeAvalDeDecisao(false, 'Ana', 'X', '').length >= 15).toBe(true);
  });
});
