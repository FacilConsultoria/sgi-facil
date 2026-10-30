import { describe, expect, it } from 'vitest';
import type { LancamentoVisivel, LinhaDoRanking, PessoaComPontuacao } from '../../types/database';
import {
  comSinal, contarDesconsiderados, descreverLancamento, descreverPosicao, descreverProjetosAtivos, filtrarLancamentos, introducaoDoRanking,
  listarPessoas, pessoaInicial, posicaoNoRanking, resumoDoPedidoDeAjusteProprio, validarAjuste, validarMotivoDaDesconsideracao,
} from './regras';

function lancamento(campos: Partial<LancamentoVisivel>): LancamentoVisivel {
  return {
    id: 'l1', pessoa_id: 'u1', tipo: 'demanda', descricao: 'Entrega no prazo', data: '2026-10-20', valor: 2, demanda_id: null, reuniao_id: null,
    criado_por: 'u9', criado_em: '2026-10-20T12:00:00Z', desconsiderado_por: null, desconsiderado_em: null, motivo_desconsideracao: null,
    demanda_codigo: null, demanda_titulo: null, pode_desconsiderar: false,
    ...campos,
  };
}

function pessoa(campos: Partial<PessoaComPontuacao>): PessoaComPontuacao {
  return {
    id: 'u1', nome: 'Ana', papel: 'membro', area_id: 'proj', nucleo_id: 'proj-cli', curso: null, setor: 'Clientes', pontos: 10,
    entregas: 0, faltas: 0, justificadas: 0, projetos_ativos: [], projetos_ocultos: 0, pode_ajustar: false, pode_pedir_aval: false,
    ...campos,
  };
}

function linhaDoRanking(pessoaId: string, nome: string, pontos: number): LinhaDoRanking {
  return { pessoa_id: pessoaId, nome, setor: 'Clientes', pontos, entregas: 0, faltas: 0 };
}

describe('comSinal', () => {
  it('mostra o sinal e usa o menos tipográfico', () => {
    expect(comSinal(2)).toBe('+2');
    expect(comSinal(-2)).toBe('−2');
    expect(comSinal(0)).toBe('0');
  });
});

describe('filtrarLancamentos', () => {
  const lista = [
    lancamento({ id: 'a', data: '2026-10-10', criado_em: '2026-10-10T10:00:00Z' }),
    lancamento({ id: 'b', tipo: 'falta', valor: -2, data: '2026-10-25' }),
    lancamento({ id: 'c', tipo: 'ajuste', data: '2026-10-25', criado_em: '2026-10-26T10:00:00Z' }),
    lancamento({ id: 'd', tipo: 'evento', data: '2026-10-05', desconsiderado_em: '2026-10-06T10:00:00Z' }),
  ];

  it('ordena do mais recente, desempatando pelo momento do lançamento', () => {
    expect(filtrarLancamentos(lista, 'tudo', true).map((l) => l.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('esconde os desconsiderados até pedirem para mostrar', () => {
    expect(filtrarLancamentos(lista, 'tudo', false).map((l) => l.id)).toEqual(['c', 'b', 'a']);
    expect(contarDesconsiderados(lista)).toBe(1);
  });

  it('filtra por tipo', () => {
    expect(filtrarLancamentos(lista, 'falta', false).map((l) => l.id)).toEqual(['b']);
    expect(filtrarLancamentos(lista, 'evento', false)).toEqual([]);
    expect(filtrarLancamentos(lista, 'evento', true).map((l) => l.id)).toEqual(['d']);
  });

  it('não altera a lista recebida', () => {
    const copia = lista.map((l) => l.id);
    filtrarLancamentos(lista, 'tudo', true);
    expect(lista.map((l) => l.id)).toEqual(copia);
  });
});

describe('descreverLancamento', () => {
  it('mostra só a descrição quando não há demanda', () => {
    expect(descreverLancamento(lancamento({ descricao: 'Falta em: Reunião geral' }))).toBe('Falta em: Reunião geral');
  });

  it('mostra o código e o título quando a demanda é visível', () => {
    expect(descreverLancamento(lancamento({ demanda_id: 'd1', demanda_codigo: 'PRJ-001', demanda_titulo: 'Fluxo AS-IS' })))
      .toBe('Entrega no prazo: PRJ-001 · Fluxo AS-IS');
  });

  it('não revela a demanda de outra área', () => {
    expect(descreverLancamento(lancamento({ demanda_id: 'd1' }))).toBe('Entrega no prazo: demanda de outra área');
  });
});

describe('ranking', () => {
  const ranking = [linhaDoRanking('u2', 'Bia', 14), linhaDoRanking('u1', 'Ana', 12), linhaDoRanking('u3', 'Caio', 10)];

  it('acha a posição da pessoa', () => {
    expect(posicaoNoRanking(ranking, 'u1')).toEqual({ posicao: 2, total: 3 });
    expect(descreverPosicao(posicaoNoRanking(ranking, 'u1'))).toBe('2º de 3');
  });

  it('devolve nulo quando a pessoa não está no ranking visível', () => {
    expect(posicaoNoRanking(ranking, 'u9')).toBe(null);
    expect(descreverPosicao(null)).toBe('–');
  });

  it('explica a visibilidade', () => {
    expect(introducaoDoRanking(true).includes('todas as pessoas')).toBe(true);
    expect(introducaoDoRanking(false).includes('restrito')).toBe(true);
  });
});

describe('listarPessoas e pessoaInicial', () => {
  const pessoas = [pessoa({ id: 'u3', nome: 'Érica' }), pessoa({ id: 'u1', nome: 'Ana' }), pessoa({ id: 'u2', nome: 'Bruno' })];

  it('ordena por nome', () => {
    expect(listarPessoas(pessoas, '').map((p) => p.nome)).toEqual(['Ana', 'Bruno', 'Érica']);
  });

  it('busca sem diferenciar maiúsculas nem acentos', () => {
    expect(listarPessoas(pessoas, 'erica').map((p) => p.nome)).toEqual(['Érica']);
    expect(listarPessoas(pessoas, ' BRU ').map((p) => p.nome)).toEqual(['Bruno']);
    expect(listarPessoas(pessoas, 'zzz')).toEqual([]);
  });

  it('abre na própria pessoa, na anterior ou na primeira', () => {
    expect(pessoaInicial(pessoas, 'u3', null)).toBe('u3');
    expect(pessoaInicial(pessoas, 'u3', 'u2')).toBe('u2');
    expect(pessoaInicial(pessoas, 'u9', null)).toBe('u1');
    expect(pessoaInicial(pessoas, 'u3', 'u9')).toBe('u3');
    expect(pessoaInicial([], 'u3', null)).toBe(null);
  });
});

describe('descreverProjetosAtivos', () => {
  it('lista os visíveis e resume os ocultos', () => {
    expect(descreverProjetosAtivos(['Mapeamento', 'Caixa'], 0)).toBe('Mapeamento | Caixa');
    expect(descreverProjetosAtivos(['Mapeamento'], 1)).toBe('Mapeamento | Projeto de outra área');
    expect(descreverProjetosAtivos([], 2)).toBe('2 projetos de outras áreas');
    expect(descreverProjetosAtivos([], 0)).toBe('Nenhum projeto ativo');
  });
});

describe('validarAjuste', () => {
  const hoje = '2026-10-30';
  const base = { valor: '3', data: '2026-10-29', justificativa: 'Participação no evento regional' };

  it('aceita um ajuste completo', () => {
    expect(validarAjuste(base, hoje)).toBe(null);
    expect(validarAjuste({ ...base, valor: '-20', data: hoje }, hoje)).toBe(null);
  });

  it('recusa valor vazio, zero, quebrado ou fora de −20 a 20', () => {
    const mensagem = 'Informe um valor inteiro entre −20 e 20, diferente de zero.';
    for (const valor of ['', '  ', '0', '1.5', 'abc', '21', '-21']) expect(validarAjuste({ ...base, valor }, hoje)).toBe(mensagem);
  });

  it('recusa data vazia ou no futuro', () => {
    expect(validarAjuste({ ...base, data: '' }, hoje)).toBe('Informe uma data de referência até hoje.');
    expect(validarAjuste({ ...base, data: '2026-10-31' }, hoje)).toBe('Informe uma data de referência até hoje.');
  });

  it('exige justificativa de 15 caracteres', () => {
    expect(validarAjuste({ ...base, justificativa: ' curta ' }, hoje)).toBe('Explique o ajuste em pelo menos 15 caracteres.');
  });

  it('exige motivo de 10 caracteres para desconsiderar', () => {
    expect(validarMotivoDaDesconsideracao('duplicado')).toBe('Escreva o motivo (mínimo 10 caracteres).');
    expect(validarMotivoDaDesconsideracao('Lançado em duplicidade')).toBe(null);
  });
});

describe('resumoDoPedidoDeAjusteProprio', () => {
  it('descreve o pedido e passa de 15 caracteres', () => {
    expect(resumoDoPedidoDeAjusteProprio('ajuste', 3, '2026-10-29', ' Horas extras no evento ')).toBe(
      'Ajuste de +3 pontos na própria pontuação (29/10/2026): Horas extras no evento');
    expect(resumoDoPedidoDeAjusteProprio('evento', -1, '2026-10-29', 'Atraso no evento').startsWith('Evento de −1 ponto na')).toBe(true);
    expect(resumoDoPedidoDeAjusteProprio('ajuste', 1, '2026-10-29', 'x').length >= 15).toBe(true);
  });
});
