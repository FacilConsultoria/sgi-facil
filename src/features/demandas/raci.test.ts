import { describe, expect, it } from 'vitest';
import type { AprovadorPossivel, DemandaVisivel, PessoaInformavel } from '../../types/database';
import {
  aprovadoresDoProjeto, aprovadorInicial, descreverComQuem, ehAR, filaDeAprovacao, informadosAutomaticos, informaveisDisponiveis, montarMatriz,
  papelNaRaci, validarRaci, validarTextoDaConversa,
} from './raci';

function demanda(campos: Partial<DemandaVisivel>): DemandaVisivel {
  return {
    id: 'd1', codigo: 'PRJ-001', projeto_id: 'p1', titulo: 'Desenhar fluxo', descricao: '', status: 'andamento',
    prioridade: 'media', prazo: '2026-11-10', concluida_em: null, criado_por: 'u1', criado_em: '', atualizado_em: '',
    projeto_nome: 'Mapeamento', projeto_cliente: '', nucleo_id: 'proj-cli', area_id: 'proj', restrita: false,
    executores: ['ana'], pode_gerir: false, pode_mudar_status: true, motivo_acesso: 'executor', nucleo_nome: 'Entregas', excecao_ate: null,
    aprovador_id: 'joao', alcance: 'parte', duvida_aberta: false, informados: [], eh_ar: false, com_quem: 'executores',
    pode_entregar: false, pode_sinalizar_duvida: false, pode_responder_duvida: false, pode_avaliar: false, na_minha_caixa: false,
    ...campos,
  };
}

const aprovador = (pessoa_id: string, nome: string, extra: Partial<AprovadorPossivel> = {}): AprovadorPossivel => ({
  projeto_id: 'p1', pessoa_id, nome, papel: 'diretor', da_presidencia: false, sugerido: false, ...extra,
});

const informavel = (id: string, nome: string, extra: Partial<PessoaInformavel> = {}): PessoaInformavel => ({
  id, nome, papel: 'diretor', area_id: 'com', automatico: false, da_presidencia: false, ...extra,
});

describe('ehAR e papelNaRaci', () => {
  it('A/R só com um executor que também aprova', () => {
    expect(ehAR(['joao'], 'joao')).toBe(true);
    expect(ehAR(['joao', 'ana'], 'joao')).toBe(false);
    expect(ehAR(['ana'], 'joao')).toBe(false);
    expect(ehAR(['joao'], null)).toBe(false);
  });

  it('dá o papel de cada pessoa', () => {
    const d = demanda({ executores: ['ana', 'joao'], aprovador_id: 'joao', informados: ['mel'] });
    expect(['ana', 'joao', 'mel', 'camila'].map((id) => papelNaRaci(d, id))).toEqual(['R', 'A/R', 'I', null]);
    expect(papelNaRaci(demanda({ executores: ['ana'], aprovador_id: 'joao' }), 'joao')).toBe('A');
  });
});

describe('descreverComQuem', () => {
  it('diz de quem é a caixa', () => {
    expect(descreverComQuem(demanda({}))).toBe('Com quem executa');
    expect(descreverComQuem(demanda({ eh_ar: true }))).toBe('Com quem executa e aprova (A/R)');
    expect(descreverComQuem(demanda({ com_quem: 'aprovador', duvida_aberta: true }))).toBe('Com quem aprova: dúvida aguardando resposta');
    expect(descreverComQuem(demanda({ com_quem: 'aprovador', status: 'revisao' }))).toBe('Com quem aprova: entrega aguardando aprovação');
    expect(descreverComQuem(demanda({ com_quem: 'ninguem', status: 'concluida' }))).toBe('Concluída');
  });
});

describe('aprovadores', () => {
  const lista = [
    aprovador('victor', 'Victor', { papel: 'gerente' }),
    aprovador('mel', 'Mel', { papel: 'presidente', da_presidencia: true }),
    aprovador('joao', 'João', { sugerido: true }),
    aprovador('outro', 'Outro', { projeto_id: 'p2' }),
  ];

  it('lista os do projeto com a sugestão primeiro; restrita, só a Presidência', () => {
    expect(aprovadoresDoProjeto(lista, 'p1', false).map((a) => a.nome)).toEqual(['João', 'Mel', 'Victor']);
    expect(aprovadoresDoProjeto(lista, 'p1', true).map((a) => a.nome)).toEqual(['Mel']);
  });

  it('mantém quem já estava escolhido; senão usa a sugestão; senão o primeiro', () => {
    const opcoes = aprovadoresDoProjeto(lista, 'p1', false);
    expect(aprovadorInicial(opcoes, 'victor')).toBe('victor');
    expect(aprovadorInicial(opcoes, 'sumiu')).toBe('joao');
    expect(aprovadorInicial(opcoes, null)).toBe('joao');
    expect(aprovadorInicial(aprovadoresDoProjeto(lista, 'p1', true), null)).toBe('mel');
    expect(aprovadorInicial([], null)).toBe(null);
  });
});

describe('informados', () => {
  const lista = [
    informavel('mel', 'Mel', { papel: 'presidente', automatico: true, da_presidencia: true }),
    informavel('luis', 'Luis', { papel: 'vice', da_presidencia: true }),
    informavel('joao', 'João'),
    informavel('ana', 'Ana Diretora'),
  ];

  it('a Presidente entra sozinha, a não ser que execute ou aprove', () => {
    expect(informadosAutomaticos(lista, ['ana'], 'joao').map((p) => p.nome)).toEqual(['Mel']);
    expect(informadosAutomaticos(lista, ['mel'], 'joao')).toEqual([]);
    expect(informadosAutomaticos(lista, ['ana'], 'mel')).toEqual([]);
  });

  it('esconde quem executa ou aprova (trava de redundância) e, restrita, quem não é da Presidência', () => {
    expect(informaveisDisponiveis(lista, ['ana'], 'joao', false).map((p) => p.nome)).toEqual(['Luis']);
    expect(informaveisDisponiveis(lista, ['x'], 'y', false).map((p) => p.nome)).toEqual(['Ana Diretora', 'João', 'Luis']);
    expect(informaveisDisponiveis(lista, ['x'], 'y', true).map((p) => p.nome)).toEqual(['Luis']);
  });
});

describe('validações', () => {
  it('usa as mesmas mensagens do banco', () => {
    expect(validarRaci({ executores: [], aprovador: 'a', alcance: 'parte' })).toBe('Atribua pelo menos um executor.');
    expect(validarRaci({ executores: ['x'], aprovador: null, alcance: 'parte' })).toBe('Escolha quem aprova a entrega.');
    expect(validarRaci({ executores: ['x'], aprovador: 'a', alcance: null })).toBe('Escolha o alcance da entrega.');
    expect(validarRaci({ executores: ['x'], aprovador: 'a', alcance: 'geral' })).toBe(null);
  });

  it('confere o texto da conversa', () => {
    expect(validarTextoDaConversa('  ', 'Escreva a dúvida.')).toBe('Escreva a dúvida.');
    expect(validarTextoDaConversa('  ', null)).toBe(null);
    expect(validarTextoDaConversa('x'.repeat(1001), null)).toBe('O texto tem no máximo 1000 caracteres.');
    expect(validarTextoDaConversa(' ok ', 'Escreva.')).toBe(null);
  });
});

describe('filaDeAprovacao', () => {
  it('dúvidas no topo, depois aprovações, por prazo', () => {
    const lista = [
      demanda({ id: 'aprovar-tarde', pode_avaliar: true, prazo: '2026-11-20' }),
      demanda({ id: 'aprovar-cedo', pode_avaliar: true, prazo: '2026-11-05' }),
      demanda({ id: 'duvida', pode_responder_duvida: true, duvida_aberta: true, prazo: '2026-12-01' }),
      demanda({ id: 'nao-e-comigo' }),
    ];
    expect(filaDeAprovacao(lista).map((d) => d.id)).toEqual(['duvida', 'aprovar-cedo', 'aprovar-tarde']);
  });
});

describe('montarMatriz', () => {
  const nomes: Record<string, string> = { ana: 'Ana', lucas: 'Lucas', joao: 'João', mel: 'Mel', victor: 'Victor' };
  const matriz = montarMatriz([
    demanda({ id: 'feita', codigo: 'PRJ-003', status: 'concluida', prazo: '2026-10-01', executores: ['ana'], aprovador_id: 'victor' }),
    demanda({ id: 'geral', codigo: 'PRJ-002', prazo: '2026-11-20', executores: ['ana', 'lucas'], aprovador_id: 'joao', informados: ['mel'] }),
    demanda({ id: 'ar', codigo: 'PRJ-001', prazo: '2026-11-15', executores: ['joao'], aprovador_id: 'joao' }),
  ], (id) => nomes[id] ?? id);

  it('abertas primeiro, por prazo; concluídas no fim', () => {
    expect(matriz.linhas.map((l) => l.demanda.id)).toEqual(['ar', 'geral', 'feita']);
  });

  it('colunas: quem aprova, depois quem executa, depois quem é informado', () => {
    expect(matriz.pessoas.map((p) => p.nome)).toEqual(['João', 'Victor', 'Ana', 'Lucas', 'Mel']);
  });

  it('cada célula com o papel da pessoa', () => {
    expect(matriz.linhas.map((l) => l.papeis)).toEqual([
      { joao: 'A/R' },
      { ana: 'R', lucas: 'R', joao: 'A', mel: 'I' },
      { ana: 'R', victor: 'A' },
    ]);
  });
});
