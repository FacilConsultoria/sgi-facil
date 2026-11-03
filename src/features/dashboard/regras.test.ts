import { describe, expect, it } from 'vitest';
import type {
  DemandaVisivel, LancamentoVisivel, LinhaDoRanking, RecadoDoPainel, ReuniaoVisivel, SolicitacaoVisivel,
} from '../../types/database';
import {
  aguardandoValidacao, descreverPrazo, descreverQuando, descreverRecado, descreverValidadeDoPedido, indicadoresDoInicio, lerDestino,
  minhasDemandasAbertas, pedidosParaDecidir, proximasReunioes, recadosRecentes, rotuloDoDestino, ultimosLancamentos, validarRecado, valorDoDestino,
} from './regras';

const HOJE = '2026-11-10';

const demanda = (alteracao: Partial<DemandaVisivel>): DemandaVisivel => ({
  id: 'd', codigo: 'COM-001', projeto_id: 'p', titulo: 'Demanda', descricao: '', status: 'andamento', prioridade: 'media', prazo: '2026-11-20',
  concluida_em: null, criado_por: 'x', criado_em: '', atualizado_em: '', projeto_nome: 'Projeto', projeto_cliente: '', nucleo_id: 'n', area_id: 'a',
  restrita: false, executores: [], pode_gerir: false, pode_mudar_status: false, motivo_acesso: 'executor', nucleo_nome: 'Núcleo', excecao_ate: null, ...alteracao,
});

const reuniao = (alteracao: Partial<ReuniaoVisivel>): ReuniaoVisivel => ({
  id: 'r', titulo: 'Reunião', data: '2026-11-12', hora: '19:00:00', escopo: 'geral', escopo_id: null, pauta: '', encerrada: false, ata: '', ata_por: null,
  ata_em: null, criado_por: 'x', criado_em: '', pode_gerir: false, convocado: true, total_anexos: 0, tem_transcricao: false, total_convocados: 0,
  total_faltas: 0, pode_encerrar: false, pode_excluir: false, ...alteracao,
} as ReuniaoVisivel);

describe('minhasDemandasAbertas e aguardandoValidacao', () => {
  const lista = [
    demanda({ id: '1', codigo: 'B-1', prazo: '2026-11-15', executores: ['eu'] }),
    demanda({ id: '2', codigo: 'A-1', prazo: '2026-11-15', executores: ['eu', 'outra'] }),
    demanda({ id: '3', prazo: '2026-11-01', executores: ['eu'] }),
    demanda({ id: '4', status: 'concluida', executores: ['eu'] }),
    demanda({ id: '5', executores: ['outra'] }),
    demanda({ id: '6', status: 'revisao', pode_gerir: true, prazo: '2026-11-12' }),
    demanda({ id: '7', status: 'revisao', pode_gerir: false }),
  ];

  it('lista só as abertas em que a pessoa é executora, por prazo e depois por código', () => {
    expect(minhasDemandasAbertas(lista, 'eu').map((d) => d.id)).toEqual(['3', '2', '1']);
  });

  it('lista só as em revisão que a pessoa pode validar', () => {
    expect(aguardandoValidacao(lista).map((d) => d.id)).toEqual(['6']);
  });

  it('não altera a lista recebida', () => {
    const original = [demanda({ id: 'b', prazo: '2026-12-01', executores: ['eu'] }), demanda({ id: 'a', prazo: '2026-11-01', executores: ['eu'] })];
    minhasDemandasAbertas(original, 'eu');
    expect(original.map((d) => d.id)).toEqual(['b', 'a']);
  });
});

describe('descreverPrazo', () => {
  it('marca como atrasada só a demanda aberta com prazo vencido', () => {
    expect(descreverPrazo(demanda({ prazo: '2026-11-05' }), HOJE)).toBe('Atrasada · 05/11');
    expect(descreverPrazo(demanda({ prazo: '2026-11-10' }), HOJE)).toBe('10/11');
    expect(descreverPrazo(demanda({ prazo: '2026-11-05', status: 'concluida' }), HOJE)).toBe('05/11');
  });
});

describe('proximasReunioes', () => {
  it('ignora encerradas e passadas, inclui hoje e ordena por data e hora', () => {
    const lista = [
      reuniao({ id: 'tarde', data: '2026-11-12', hora: '19:00:00' }),
      reuniao({ id: 'cedo', data: '2026-11-12', hora: '09:00:00' }),
      reuniao({ id: 'hoje', data: HOJE }),
      reuniao({ id: 'passada', data: '2026-11-01' }),
      reuniao({ id: 'encerrada', data: '2026-11-15', encerrada: true }),
    ];
    expect(proximasReunioes(lista, HOJE).map((r) => r.id)).toEqual(['hoje', 'cedo', 'tarde']);
  });

  it('descreve data e hora', () => {
    expect(descreverQuando({ data: '2026-11-12', hora: '19:00:00' })).toBe('12/11 · 19:00');
  });
});

describe('ultimosLancamentos', () => {
  const lancamento = (alteracao: Partial<LancamentoVisivel>): LancamentoVisivel => ({
    id: 'l', pessoa_id: 'eu', tipo: 'demanda', descricao: 'Entrega no prazo', data: '2026-11-01', valor: 2, demanda_id: null, reuniao_id: null,
    criado_por: null, criado_em: '2026-11-01T10:00:00Z', desconsiderado_por: null, desconsiderado_em: null, motivo_desconsideracao: null,
    demanda_codigo: null, demanda_titulo: null, pode_desconsiderar: false, ...alteracao,
  });

  it('tira os desconsiderados, ordena do mais recente e limita', () => {
    const lista = [
      lancamento({ id: 'a', data: '2026-11-01' }),
      lancamento({ id: 'b', data: '2026-11-03' }),
      lancamento({ id: 'c', data: '2026-11-03', criado_em: '2026-11-03T12:00:00Z' }),
      lancamento({ id: 'd', data: '2026-11-04', desconsiderado_em: '2026-11-05T00:00:00Z' }),
    ];
    expect(ultimosLancamentos(lista).map((l) => l.id)).toEqual(['c', 'b', 'a']);
    expect(ultimosLancamentos(lista, 2).map((l) => l.id)).toEqual(['c', 'b']);
  });
});

describe('pedidosParaDecidir', () => {
  const pedido = (alteracao: Partial<SolicitacaoVisivel>): SolicitacaoVisivel => ({
    id: 's', situacao: 'pendente', pode_aprovar: false, pode_pedir_aval: false, valido_ate: '2026-12-05', criado_em: '2026-11-01', ...alteracao,
  } as SolicitacaoVisivel);

  it('traz só os pendentes que a pessoa decide (ou pede aval), do mais antigo', () => {
    const lista = [
      pedido({ id: 'novo', pode_aprovar: true, criado_em: '2026-11-05' }),
      pedido({ id: 'velho', pode_aprovar: true, criado_em: '2026-11-01' }),
      pedido({ id: 'aval', pode_pedir_aval: true, criado_em: '2026-11-03' }),
      pedido({ id: 'dos-outros' }),
      pedido({ id: 'vigente', situacao: 'aprovada', pode_aprovar: true }),
    ];
    expect(pedidosParaDecidir(lista).map((s) => s.id)).toEqual(['velho', 'aval', 'novo']);
  });

  it('descreve a validade pedida', () => {
    expect(descreverValidadeDoPedido({ valido_ate: '2026-12-05' })).toBe('até 05/12');
  });
});

describe('indicadoresDoInicio', () => {
  const ranking: LinhaDoRanking[] = [
    { pessoa_id: 'outra', nome: 'Outra', setor: 'x', pontos: 14, entregas: 3, faltas: 0 },
    { pessoa_id: 'eu', nome: 'Eu', setor: 'x', pontos: 12, entregas: 1, faltas: 0 },
  ];

  it('mostra pontos, posição, abertas, em revisão, atrasadas e a próxima reunião', () => {
    const minhas = [
      demanda({ id: '1', prazo: '2026-11-01', executores: ['eu'] }),
      demanda({ id: '2', status: 'revisao', prazo: '2026-11-30', executores: ['eu'] }),
      demanda({ id: '3', prazo: '2026-11-30', executores: ['eu'] }),
    ];
    const proximas = [reuniao({ titulo: 'Geral de novembro', data: '2026-11-12' })];
    const [pontos, abertas, atrasadas, proxima] = indicadoresDoInicio({ minhas, ranking, proximas, meuId: 'eu', hoje: HOJE });
    expect([pontos?.valor, pontos?.detalhe]).toEqual(['12', '2º no ranking']);
    expect([abertas?.valor, abertas?.detalhe]).toEqual(['3', '1 em revisão']);
    expect([atrasadas?.valor, atrasadas?.alerta]).toEqual(['1', true]);
    expect([proxima?.valor, proxima?.detalhe]).toEqual(['12/11', 'Geral de novembro']);
  });

  it('usa traço e textos próprios quando não há ranking, atraso nem reunião', () => {
    const [pontos, abertas, atrasadas, proxima] = indicadoresDoInicio({ minhas: [], ranking: [], proximas: [], meuId: 'eu', hoje: HOJE });
    expect([pontos?.valor, pontos?.detalhe]).toEqual(['–', 'Fora do ranking visível']);
    expect([abertas?.valor, atrasadas?.valor, atrasadas?.alerta]).toEqual(['0', '0', false]);
    expect([proxima?.valor, proxima?.detalhe]).toEqual(['–', 'Nenhuma agendada']);
  });
});

const recado = (alteracao: Partial<RecadoDoPainel>): RecadoDoPainel => ({
  id: 'r', titulo: 'Aviso', texto: 'Texto', escopo: 'todos', escopo_id: null, autor_id: 'x', autor_nome: 'Mel', publico: 'Toda a equipe',
  criado_em: '2026-11-09T15:00:00Z', pode_retirar: false, ...alteracao,
});

describe('recadosRecentes', () => {
  it('mostra os dos últimos 30 dias, do mais novo para o mais antigo, até o limite', () => {
    const lista = [
      recado({ id: 'velho', criado_em: '2026-09-01T12:00:00Z' }),
      recado({ id: 'a', criado_em: '2026-11-01T12:00:00Z' }),
      recado({ id: 'b', criado_em: '2026-11-09T12:00:00Z' }),
      recado({ id: 'c', criado_em: '2026-10-20T12:00:00Z' }),
    ];
    expect(recadosRecentes(lista, HOJE).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(recadosRecentes(lista, HOJE, 2).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('inclui o recado de hoje (no horário de São Paulo)', () => {
    expect(recadosRecentes([recado({ id: 'hoje', criado_em: '2026-11-10T12:30:00Z' })], HOJE).map((r) => r.id)).toEqual(['hoje']);
  });
});

describe('descreverRecado', () => {
  it('junta autor, público e dia', () => {
    expect(descreverRecado(recado({}))).toBe('Mel · Toda a equipe · 09/11');
  });
});

describe('destino do recado', () => {
  it('dá nome e valor a cada destino', () => {
    expect(rotuloDoDestino({ escopo: 'todos', nome: 'Toda a equipe' })).toBe('Toda a equipe');
    expect(rotuloDoDestino({ escopo: 'area', nome: 'Diretoria Comercial' })).toBe('Área · Diretoria Comercial');
    expect(rotuloDoDestino({ escopo: 'nucleo', nome: 'Marketing' })).toBe('Núcleo · Marketing');
    expect(valorDoDestino({ escopo: 'todos', escopo_id: null })).toBe('todos:');
    expect(valorDoDestino({ escopo: 'nucleo', escopo_id: 'com-mkt' })).toBe('nucleo:com-mkt');
  });

  it('lê o valor de volta e recusa o que não faz sentido', () => {
    expect(lerDestino('todos:')).toEqual({ escopo: 'todos', escopoId: null });
    expect(lerDestino('area:com')).toEqual({ escopo: 'area', escopoId: 'com' });
    expect(lerDestino('area:')).toBe(null);
    expect(lerDestino('geral:')).toBe(null);
    expect(lerDestino('')).toBe(null);
  });
});

describe('validarRecado', () => {
  const certo = { titulo: 'Reunião adiada', texto: 'Passou para sexta.', destino: 'todos:' };

  it('aceita um recado completo', () => {
    expect(validarRecado(certo)).toBe(null);
  });

  it('pede público, título e texto, nesta ordem', () => {
    expect(validarRecado({ ...certo, destino: '' })).toBe('Escolha para quem é o recado.');
    expect(validarRecado({ ...certo, titulo: '   ' })).toBe('Dê um título ao recado.');
    expect(validarRecado({ ...certo, texto: '  ' })).toBe('Escreva o recado.');
  });

  it('respeita os limites de tamanho', () => {
    expect(validarRecado({ ...certo, titulo: 'x'.repeat(81) })).toBe('O título pode ter até 80 caracteres.');
    expect(validarRecado({ ...certo, titulo: 'x'.repeat(80) })).toBe(null);
    expect(validarRecado({ ...certo, texto: 'x'.repeat(1001) })).toBe('O recado pode ter até 1000 caracteres.');
  });
});
