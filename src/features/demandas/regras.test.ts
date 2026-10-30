import { describe, expect, it } from 'vitest';
import type { DemandaVisivel, PessoaAtribuivel } from '../../types/database';
import {
  agruparExecutores, dataCompleta, dataCurta, dataEHora, demandasDaEtapa, estaAtrasada, explicarAcesso, filtrarDemandas,
  FILTROS_VAZIOS, hojeEmSaoPaulo, iniciais, resumir, somarDias, statusPermitidos, validarDemanda,
} from './regras';

function demanda(campos: Partial<DemandaVisivel>): DemandaVisivel {
  return {
    id: 'd1', codigo: 'PRJ-001', projeto_id: 'p1', titulo: 'Desenhar fluxo', descricao: '', status: 'afazer',
    prioridade: 'media', prazo: '2026-11-10', concluida_em: null, criado_por: 'u1', criado_em: '2026-10-30T12:00:00Z',
    atualizado_em: '2026-10-30T12:00:00Z', projeto_nome: 'Mapeamento', projeto_cliente: 'Padaria', nucleo_id: 'proj-cli',
    area_id: 'proj', restrita: false, executores: ['u2'], pode_gerir: false, pode_mudar_status: true,
    motivo_acesso: 'executor', nucleo_nome: 'Entregas aos clientes', excecao_ate: null,
    ...campos,
  };
}

function pessoa(id: string, nome: string, nucleo: string | null): PessoaAtribuivel {
  return { id, nome, papel: 'membro', area_id: 'proj', nucleo_id: nucleo };
}

describe('datas', () => {
  it('usa o dia de São Paulo, não o UTC', () => {
    // 01:30 UTC de 31/10 ainda é 30/10 em São Paulo
    expect(hojeEmSaoPaulo(new Date('2026-10-31T01:30:00Z'))).toBe('2026-10-30');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-30', 7)).toBe('2026-11-06');
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('formata datas e horários', () => {
    expect(dataCurta('2026-11-05')).toBe('05/11');
    expect(dataCompleta('2026-11-05')).toBe('05/11/2026');
    expect(dataEHora('2026-11-05T17:30:00Z')).toBe('05/11 14:30');
  });

  it('marca atraso só em demanda aberta com prazo vencido', () => {
    expect(estaAtrasada({ status: 'andamento', prazo: '2026-10-29' }, '2026-10-30')).toBe(true);
    expect(estaAtrasada({ status: 'andamento', prazo: '2026-10-30' }, '2026-10-30')).toBe(false);
    expect(estaAtrasada({ status: 'concluida', prazo: '2026-10-01' }, '2026-10-30')).toBe(false);
  });
});

describe('iniciais', () => {
  it('pega a primeira e a última inicial', () => {
    expect(iniciais('Ana Paula Ferraz')).toBe('AF');
    expect(iniciais(' mel ')).toBe('M');
  });
});

describe('filtrarDemandas', () => {
  const lista = [
    demanda({ id: 'a', codigo: 'PRJ-001', titulo: 'Revisão do contrato', projeto_id: 'p1', executores: ['u2'] }),
    demanda({ id: 'b', codigo: 'COM-002', titulo: 'Carrossel', projeto_id: 'p2', executores: ['u3'] }),
  ];

  it('busca por título sem acento e por código', () => {
    expect(filtrarDemandas(lista, { ...FILTROS_VAZIOS, busca: 'revisao' }, 'u9').map((d) => d.id)).toEqual(['a']);
    expect(filtrarDemandas(lista, { ...FILTROS_VAZIOS, busca: 'com-002' }, 'u9').map((d) => d.id)).toEqual(['b']);
  });

  it('filtra por projeto, executor e "só as minhas"', () => {
    expect(filtrarDemandas(lista, { ...FILTROS_VAZIOS, projeto: 'p2' }, 'u9').map((d) => d.id)).toEqual(['b']);
    expect(filtrarDemandas(lista, { ...FILTROS_VAZIOS, executor: 'u2' }, 'u9').map((d) => d.id)).toEqual(['a']);
    expect(filtrarDemandas(lista, { ...FILTROS_VAZIOS, soMinhas: true }, 'u3').map((d) => d.id)).toEqual(['b']);
  });
});

describe('demandasDaEtapa', () => {
  it('ordena por prazo, depois prioridade', () => {
    const lista = [
      demanda({ id: 'tarde', prazo: '2026-11-20', prioridade: 'alta' }),
      demanda({ id: 'cedo-baixa', prazo: '2026-11-01', prioridade: 'baixa' }),
      demanda({ id: 'cedo-alta', prazo: '2026-11-01', prioridade: 'alta' }),
      demanda({ id: 'outra-etapa', status: 'revisao' }),
    ];
    expect(demandasDaEtapa(lista, 'afazer').map((d) => d.id)).toEqual(['cedo-alta', 'cedo-baixa', 'tarde']);
  });
});

describe('resumir', () => {
  it('conta etapas e atrasos', () => {
    const lista = [
      demanda({ status: 'andamento', prazo: '2026-10-01' }),
      demanda({ status: 'revisao', prazo: '2026-12-01' }),
      demanda({ status: 'concluida', prazo: '2026-10-01' }),
    ];
    expect(resumir(lista, '2026-10-30')).toEqual({ total: 3, andamento: 1, revisao: 1, atrasadas: 1, concluidas: 1 });
  });
});

describe('statusPermitidos', () => {
  it('só oferece "Concluída" a quem gere a demanda', () => {
    expect(statusPermitidos({ pode_gerir: false })).toEqual(['afazer', 'andamento', 'revisao']);
    expect(statusPermitidos({ pode_gerir: true })).toEqual(['afazer', 'andamento', 'revisao', 'concluida']);
  });
});

describe('explicarAcesso', () => {
  const titulo = (id: string): string => (id === 'proj' ? 'Diretoria de Projetos' : id);

  it('explica cada motivo calculado pelo banco', () => {
    expect(explicarAcesso(demanda({ motivo_acesso: 'diretoria' }), titulo)).toBe('A demanda pertence à Diretoria de Projetos, que você conduz.');
    expect(explicarAcesso(demanda({ motivo_acesso: 'nucleo' }), titulo)).toBe('A demanda é do núcleo Entregas aos clientes, que você lidera.');
    expect(explicarAcesso(demanda({ motivo_acesso: 'excecao', excecao_ate: '2026-11-30' }), titulo))
      .toBe('Liberação por exceção válida até 30/11/2026. Acesso somente para consulta.');
  });
});

describe('agruparExecutores', () => {
  const atribuiveis = [pessoa('u2', 'Lucas', 'proj-cli'), pessoa('u1', 'Ana', 'proj-cli'), pessoa('u5', 'Camila', 'com-mkt')];
  const nomes: Record<string, string> = { u9: 'Pedro' };

  it('separa núcleo do projeto, restante do escopo e atribuídos fora do escopo', () => {
    const grupos = agruparExecutores(atribuiveis, 'proj-cli', ['u9', 'u1'], (id) => nomes[id] ?? id);
    expect(grupos.map((g) => [g.titulo, g.pessoas.map((p) => p.nome)])).toEqual([
      ['Núcleo do projeto', ['Ana', 'Lucas']],
      ['Outras pessoas no seu escopo', ['Camila']],
      ['Já atribuídos, fora do seu escopo', ['Pedro']],
    ]);
  });

  it('omite grupos vazios', () => {
    expect(agruparExecutores(atribuiveis, null, [], (id) => id).map((g) => g.titulo)).toEqual(['Outras pessoas no seu escopo']);
  });
});

describe('validarDemanda', () => {
  it('usa as mesmas mensagens do banco', () => {
    expect(validarDemanda({ titulo: '  ', prazo: '2026-11-01', executores: ['u1'] })).toBe('Dê um título à demanda.');
    expect(validarDemanda({ titulo: 'X', prazo: '', executores: ['u1'] })).toBe('Informe o prazo.');
    expect(validarDemanda({ titulo: 'X', prazo: '2026-11-01', executores: [] })).toBe('Atribua pelo menos um executor.');
    expect(validarDemanda({ titulo: 'X', prazo: '2026-11-01', executores: ['u1'] })).toBe(null);
  });
});
