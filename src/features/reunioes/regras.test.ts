import { describe, expect, it } from 'vitest';
import type { ConvocadoDaReuniao, Presenca, PublicoDeReuniao, ReuniaoVisivel } from '../../types/database';
import {
  agruparPublicosParaAgendar, caminhoDoAnexo, chaveDoPublico, contarPresencas, descreverReuniao, ehPublicoDePessoas,
  extensaoDoArquivo, formatarTamanho, LIMITE_DO_ANEXO_EM_BYTES, nomeDoPublico, nomeSeguroDeArquivo, opcoesDePresenca,
  podePedirAvalDeJustificativa, presencasParaEnvio, resumoDoPedidoDeJustificativa, separarReunioes, situacaoDaReuniao,
  validarArquivo, validarExclusao, validarMotivoDoAval, validarPresencasParaEncerrar, validarReuniao, validarTranscricao,
} from './regras';

function reuniao(campos: Partial<ReuniaoVisivel>): ReuniaoVisivel {
  return {
    id: 'r1', titulo: 'Alinhamento', data: '2026-11-10', hora: '19:00:00', escopo: 'geral', escopo_id: null, pauta: '',
    encerrada: false, ata: '', ata_por: null, ata_em: null, criado_por: 'u1', criado_em: '2026-10-30T12:00:00Z',
    pode_gerir: false, convocado: true, total_anexos: 0, tem_transcricao: false, total_convocados: 11, total_faltas: 0,
    pode_encerrar: false, pode_excluir: false, pode_justificar_diretoria: false,
    ...campos,
  };
}

function publico(escopo: PublicoDeReuniao['escopo'], escopoId: string | null, titulo: string, podeCriar: boolean): PublicoDeReuniao {
  return { escopo, escopo_id: escopoId, titulo, pode_criar: podeCriar, total_convocados: 3 };
}

const PUBLICOS = [
  publico('geral', null, 'Reunião geral', true),
  publico('presidencia', null, 'Presidência', true),
  publico('area', 'proj', 'Diretoria de Projetos', true),
  publico('area', 'com', 'Diretoria Comercial', true),
  publico('area', 'fin', 'Diretoria Financeira', false),
  publico('nucleo', 'com-mkt', 'Marketing · Diretoria Comercial', true),
  publico('pessoas', null, 'Pessoas escolhidas', true),
];

describe('públicos', () => {
  it('acha o nome do público de uma reunião', () => {
    expect(nomeDoPublico(reuniao({ escopo: 'nucleo', escopo_id: 'com-mkt' }), PUBLICOS)).toBe('Marketing · Diretoria Comercial');
    expect(nomeDoPublico(reuniao({ escopo: 'geral' }), PUBLICOS)).toBe('Reunião geral');
    expect(nomeDoPublico(reuniao({ escopo: 'area', escopo_id: 'xyz' }), PUBLICOS)).toBe('Público não encontrado');
  });

  it('diferencia públicos pelo tipo e pelo id', () => {
    expect(chaveDoPublico('area', 'com')).toBe('area:com');
    expect(chaveDoPublico('geral', null)).toBe('geral:');
  });

  it('agrupa só os públicos em que a pessoa pode agendar, em ordem', () => {
    expect(agruparPublicosParaAgendar(PUBLICOS).map((g) => [g.titulo, g.publicos.map((p) => p.titulo)])).toEqual([
      ['Toda a Fácil', ['Reunião geral', 'Presidência']],
      ['Diretorias', ['Diretoria Comercial', 'Diretoria de Projetos']],
      ['Núcleos', ['Marketing · Diretoria Comercial']],
      ['Pessoas específicas', ['Pessoas escolhidas']],
    ]);
  });

  it('reconhece o público de pessoas escolhidas', () => {
    expect(ehPublicoDePessoas('pessoas:')).toBe(true);
    expect(ehPublicoDePessoas('geral:')).toBe(false);
    expect(nomeDoPublico(reuniao({ escopo: 'pessoas', escopo_id: null }), PUBLICOS)).toBe('Pessoas escolhidas');
  });

  it('omite grupos sem nenhum público disponível', () => {
    expect(agruparPublicosParaAgendar([publico('geral', null, 'Reunião geral', false)])).toEqual([]);
    expect(agruparPublicosParaAgendar(PUBLICOS.filter((p) => p.escopo === 'nucleo')).map((g) => g.titulo)).toEqual(['Núcleos']);
  });
});

describe('lista de reuniões', () => {
  it('marca encerrada, pendente e agendada', () => {
    expect(situacaoDaReuniao({ encerrada: true, data: '2026-01-01' }, '2026-10-30')).toBe('encerrada');
    expect(situacaoDaReuniao({ encerrada: false, data: '2026-10-29' }, '2026-10-30')).toBe('pendente');
    expect(situacaoDaReuniao({ encerrada: false, data: '2026-10-30' }, '2026-10-30')).toBe('agendada');
    expect(situacaoDaReuniao({ encerrada: false, data: '2026-11-02' }, '2026-10-30')).toBe('agendada');
  });

  it('separa abertas (da mais antiga) e encerradas (da mais recente)', () => {
    const lista = [
      reuniao({ id: 'a', data: '2026-11-20' }),
      reuniao({ id: 'b', data: '2026-11-05', hora: '10:00:00' }),
      reuniao({ id: 'c', data: '2026-11-05', hora: '08:00:00' }),
      reuniao({ id: 'd', data: '2026-09-01', encerrada: true }),
      reuniao({ id: 'e', data: '2026-10-01', encerrada: true }),
    ];
    const { abertas, encerradas } = separarReunioes(lista);
    expect(abertas.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(encerradas.map((r) => r.id)).toEqual(['e', 'd']);
  });

  it('descreve a reunião com o que existe nela', () => {
    expect(descreverReuniao(reuniao({}), 'Reunião geral')).toBe('19:00 · Reunião geral · 11 convocados');
    expect(descreverReuniao(reuniao({ encerrada: true, total_faltas: 1, total_anexos: 2, tem_transcricao: true, total_convocados: 1 }), 'Marketing'))
      .toBe('19:00 · Marketing · 1 convocado · 1 falta · 2 anexos · transcrição');
  });
});

describe('presença', () => {
  const convocados: ConvocadoDaReuniao[] = [
    { pessoa_id: 'a', presenca: 'presente' },
    { pessoa_id: 'b', presenca: 'falta' },
    { pessoa_id: 'c', presenca: 'justificada' },
    { pessoa_id: 'd', presenca: null },
    { pessoa_id: 'e', presenca: 'presente' },
  ];

  it('conta cada situação', () => {
    expect(contarPresencas(convocados)).toEqual({ presente: 2, justificada: 1, falta: 1, semRegistro: 1 });
  });

  it('monta o objeto enviado ao banco', () => {
    const selecoes = new Map<string, Presenca | ''>([['a', 'presente'], ['d', '']]);
    expect(presencasParaEnvio(selecoes)).toEqual({ a: 'presente', d: '' });
  });

  it('antecipa a mensagem do banco para o encerramento incompleto', () => {
    expect(validarPresencasParaEncerrar(new Map<string, Presenca | ''>([['a', 'presente'], ['b', ''], ['c', '']]))).toBe('Marque a presença de todos (2 sem registro).');
    expect(validarPresencasParaEncerrar(new Map<string, Presenca | ''>([['a', 'presente']]))).toBe(null);
  });
});

describe('presença de diretoria e aval', () => {
  it('bloqueia "justificada" para diretor quando quem organiza não é Presidente nem Vice', () => {
    const justificada = (diretor: boolean, presex: boolean, atual: Presenca | null) =>
      opcoesDePresenca(diretor, presex, atual).find((o) => o.id === 'justificada');
    expect(justificada(true, false, 'falta')).toEqual({ id: 'justificada', nome: 'Falta justificada (precisa de aval)', bloqueada: true });
    expect(justificada(true, true, 'falta')?.bloqueada).toBe(false);
    expect(justificada(false, false, 'falta')?.bloqueada).toBe(false);
    expect(justificada(true, false, 'justificada')?.bloqueada).toBe(false);
  });

  it('as demais opções nunca são bloqueadas', () => {
    expect(opcoesDePresenca(true, false, null).filter((o) => o.bloqueada).map((o) => o.id)).toEqual(['justificada']);
  });

  it('oferece o pedido de aval só para falta já salva de diretor', () => {
    expect(podePedirAvalDeJustificativa(true, false, 'falta')).toBe(true);
    expect(podePedirAvalDeJustificativa(true, false, null)).toBe(false);
    expect(podePedirAvalDeJustificativa(true, false, 'presente')).toBe(false);
    expect(podePedirAvalDeJustificativa(false, false, 'falta')).toBe(false);
    expect(podePedirAvalDeJustificativa(true, true, 'falta')).toBe(false);
  });

  it('exige motivo e monta o resumo do pedido', () => {
    expect(validarMotivoDoAval('curto')).toBe('Explique o motivo em pelo menos 10 caracteres.');
    expect(validarMotivoDoAval('Viagem a trabalho')).toBe(null);
    expect(resumoDoPedidoDeJustificativa('João', 'Status das entregas', ' Viagem a trabalho ')).toBe('Justificar a falta de João na reunião “Status das entregas”: Viagem a trabalho');
    expect(resumoDoPedidoDeJustificativa('Ana', 'X', 'Consulta médica').length >= 15).toBe(true);
  });
});

describe('exclusão', () => {
  it('só exige motivo quando a reunião já foi encerrada', () => {
    expect(validarExclusao(false, '')).toBe(null);
    expect(validarExclusao(true, 'curto')).toBe('Escreva o motivo da exclusão (mínimo 10 caracteres).');
    expect(validarExclusao(true, 'Lançada por engano')).toBe(null);
  });
});

describe('formulários', () => {
  it('exige pessoas marcadas no público de pessoas escolhidas', () => {
    const base = { titulo: 'X', data: '2026-11-01', hora: '19:00', publico: 'pessoas:' };
    expect(validarReuniao(base)).toBe('Escolha pelo menos uma pessoa para convocar.');
    expect(validarReuniao({ ...base, pessoasEscolhidas: 0 })).toBe('Escolha pelo menos uma pessoa para convocar.');
    expect(validarReuniao({ ...base, pessoasEscolhidas: 2 })).toBe(null);
    expect(validarReuniao({ ...base, publico: 'geral:' })).toBe(null);
  });

  it('valida a nova reunião na ordem do banco', () => {
    expect(validarReuniao({ titulo: ' ', data: '2026-11-01', hora: '19:00', publico: 'geral:' })).toBe('Dê um título à reunião.');
    expect(validarReuniao({ titulo: 'X', data: '', hora: '19:00', publico: 'geral:' })).toBe('Informe data e horário.');
    expect(validarReuniao({ titulo: 'X', data: '2026-11-01', hora: '', publico: 'geral:' })).toBe('Informe data e horário.');
    expect(validarReuniao({ titulo: 'X', data: '2026-11-01', hora: '19:00', publico: '' })).toBe('Escolha um público da lista.');
    expect(validarReuniao({ titulo: 'X', data: '2026-11-01', hora: '19:00', publico: 'geral:' })).toBe(null);
  });

  it('exige transcrição com pelo menos 30 caracteres', () => {
    expect(validarTranscricao('curta')).toBe('Cole a transcrição completa (mínimo 30 caracteres).');
    expect(validarTranscricao(' '.repeat(40))).toBe('Cole a transcrição completa (mínimo 30 caracteres).');
    expect(validarTranscricao('a'.repeat(30))).toBe(null);
  });
});

describe('anexos', () => {
  it('formata o tamanho', () => {
    expect(formatarTamanho(900)).toBe('900 B');
    expect(formatarTamanho(320 * 1024)).toBe('320 KB');
    expect(formatarTamanho(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });

  it('mostra a sigla do tipo do arquivo', () => {
    expect(extensaoDoArquivo('Ata final.pdf', 'application/pdf')).toBe('PDF');
    expect(extensaoDoArquivo('planilha.xlsx', 'application/vnd.ms-excel')).toBe('XLSX');
    expect(extensaoDoArquivo('semextensao', 'image/png')).toBe('PNG');
    expect(extensaoDoArquivo('arquivo.extensaolonga', 'text/plain')).toBe('PLAI');
  });

  it('limpa o nome para o armazenamento mantendo a extensão', () => {
    expect(nomeSeguroDeArquivo('Apresentação Final (v2).pptx')).toBe('Apresentacao_Final_v2.pptx');
    expect(nomeSeguroDeArquivo('../../etc/passwd')).toBe('etc_passwd');
    expect(nomeSeguroDeArquivo('???')).toBe('arquivo');
    expect(nomeSeguroDeArquivo(`${'a'.repeat(200)}.pdf`).length).toBe(100);
    expect(nomeSeguroDeArquivo(`${'a'.repeat(200)}.pdf`).endsWith('.pdf')).toBe(true);
  });

  it('põe o arquivo na pasta da reunião', () => {
    expect(caminhoDoAnexo('abc-123', 'Ata final.pdf', 'f00dcafe')).toBe('abc-123/f00dcafe-Ata_final.pdf');
  });

  it('recusa arquivo vazio ou grande demais', () => {
    expect(validarArquivo({ name: 'a.pdf', size: 0 })).toBe('“a.pdf” está vazio.');
    expect(validarArquivo({ name: 'b.zip', size: LIMITE_DO_ANEXO_EM_BYTES + 1 })).toBe('“b.zip” passa de 50,0 MB.');
    expect(validarArquivo({ name: 'c.pdf', size: LIMITE_DO_ANEXO_EM_BYTES })).toBe(null);
  });
});
