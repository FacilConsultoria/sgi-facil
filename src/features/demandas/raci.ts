// Regras de apresentação da matriz RACI (R executa, A aprova, I é informado). Funções puras, sem acesso a dados.
// Quem pode aprovar, quem pode ser informado e o que cada pessoa pode fazer em cada etapa vêm prontos do banco
// (aprovadores_possiveis, pessoas_informaveis e os indicadores de demandas_visiveis); aqui só viram texto e ordem.
import type {
  AlcanceDaEntrega, AprovadorPossivel, DemandaVisivel, PessoaInformavel, TipoDeMensagemDaDemanda,
} from '../../types/database';

export type PapelNaRaci = 'R' | 'A' | 'A/R' | 'I';

export const PERGUNTA_DO_EXECUTOR = 'Quem vai colocar a mão na massa nesta entrega?';
export const PERGUNTA_DO_APROVADOR = 'Quem dá o aval final e responde pelo resultado desta entrega?';
export const PERGUNTA_DO_ALCANCE = 'Esta entrega impacta a Fácil como um todo ou apenas uma parte do time?';

export const ALCANCES: readonly { id: AlcanceDaEntrega; nome: string; exemplos: string; efeito: string }[] = [
  {
    id: 'parte',
    nome: 'Apenas uma parte do time',
    exemplos: 'Treinamento interno da diretoria, atualização de script de abordagem, organização de arquivos ou alinhamento de rotina setorial.',
    efeito: 'O fluxo termina com quem aprova, sem avisar mais ninguém.',
  },
  {
    id: 'geral',
    nome: 'A Fácil como um todo',
    exemplos: 'Fechamento de venda ou contrato, movimentação de indicadores da EJ (faturamento, NPS, metas), parcerias institucionais ou eventos gerais.',
    efeito: 'Quando a entrega for aprovada, a Presidência recebe o aviso de conclusão.',
  },
];

export const NOME_DO_ALCANCE: Record<AlcanceDaEntrega, string> = { parte: 'Apenas uma parte do time', geral: 'A Fácil como um todo' };

export const NOME_DA_MENSAGEM: Record<TipoDeMensagemDaDemanda, string> = {
  entrega: 'Entrega',
  duvida: 'Dúvida',
  resposta: 'Resposta',
  ajuste: 'Ajuste pedido',
  aprovacao: 'Aprovação',
};

/** Limite dos textos de dúvida, resposta, ajuste e notas (o banco confere o mesmo). */
export const LIMITE_DO_TEXTO_DA_CONVERSA = 1000;

/** Um só executor, que também aprova (A/R): concluir encerra direto, sem autoaprovação. */
export function ehAR(executores: readonly string[], aprovador: string | null): boolean {
  return aprovador !== null && executores.length === 1 && executores[0] === aprovador;
}

/** Papel de uma pessoa na RACI da demanda, ou null se ela não está na matriz. */
export function papelNaRaci(
  demanda: Pick<DemandaVisivel, 'executores' | 'aprovador_id' | 'informados'>,
  pessoaId: string,
): PapelNaRaci | null {
  const executa = demanda.executores.includes(pessoaId);
  const aprova = demanda.aprovador_id === pessoaId;
  if (executa && aprova) return 'A/R';
  if (aprova) return 'A';
  if (executa) return 'R';
  return demanda.informados.includes(pessoaId) ? 'I' : null;
}

/** Com quem a demanda está agora, em uma frase curta. */
export function descreverComQuem(demanda: Pick<DemandaVisivel, 'com_quem' | 'duvida_aberta' | 'status' | 'eh_ar'>): string {
  if (demanda.com_quem === 'ninguem') return 'Concluída';
  if (demanda.com_quem === 'aprovador') {
    return demanda.duvida_aberta ? 'Com quem aprova: dúvida aguardando resposta' : 'Com quem aprova: entrega aguardando aprovação';
  }
  return demanda.eh_ar ? 'Com quem executa e aprova (A/R)' : 'Com quem executa';
}

/** Quem pode aprovar no projeto (só a Presidência se a demanda for restrita): a sugestão primeiro, depois por nome. */
export function aprovadoresDoProjeto(
  aprovadores: readonly AprovadorPossivel[],
  projetoId: string,
  restrita: boolean,
): AprovadorPossivel[] {
  return aprovadores
    .filter((a) => a.projeto_id === projetoId && (!restrita || a.da_presidencia))
    .sort((a, b) => Number(b.sugerido) - Number(a.sugerido) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Quem já vem marcado como aprovador: quem já estava escolhido, se ainda está na lista; senão a sugestão do banco
 * (diretoria da área); senão o primeiro da lista.
 */
export function aprovadorInicial(opcoes: readonly AprovadorPossivel[], atual: string | null): string | null {
  if (atual && opcoes.some((a) => a.pessoa_id === atual)) return atual;
  return (opcoes.find((a) => a.sugerido) ?? opcoes[0])?.pessoa_id ?? null;
}

/** Quem é informado sozinho com alcance geral (a Presidente), a não ser que já execute ou aprove. */
export function informadosAutomaticos(
  informaveis: readonly PessoaInformavel[],
  executores: readonly string[],
  aprovador: string | null,
): PessoaInformavel[] {
  return informaveis.filter((p) => p.automatico && p.id !== aprovador && !executores.includes(p.id));
}

/**
 * Quem dá para incluir como informado: sem a Presidente (que já entra sozinha) e sem quem executa ou aprova
 * (trava contra papéis duplicados). Demanda restrita: só a Presidência.
 */
export function informaveisDisponiveis(
  informaveis: readonly PessoaInformavel[],
  executores: readonly string[],
  aprovador: string | null,
  restrita: boolean,
): PessoaInformavel[] {
  return informaveis
    .filter((p) => !p.automatico && p.id !== aprovador && !executores.includes(p.id) && (!restrita || p.da_presidencia))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export interface CamposDaRaci {
  executores: readonly string[];
  aprovador: string | null;
  alcance: AlcanceDaEntrega | null;
}

/** Checagem antes de enviar, com as mesmas mensagens do banco (que confere de novo). */
export function validarRaci(campos: CamposDaRaci): string | null {
  if (campos.executores.length === 0) return 'Atribua pelo menos um executor.';
  if (!campos.aprovador) return 'Escolha quem aprova a entrega.';
  if (!campos.alcance) return 'Escolha o alcance da entrega.';
  return null;
}

/** Texto obrigatório de dúvida, resposta ou ajuste: a mensagem do problema ou null. */
export function validarTextoDaConversa(texto: string, mensagemSeVazio: string | null): string | null {
  const limpo = texto.trim();
  if (!limpo && mensagemSeVazio) return mensagemSeVazio;
  if (limpo.length > LIMITE_DO_TEXTO_DA_CONVERSA) return `O texto tem no máximo ${LIMITE_DO_TEXTO_DA_CONVERSA} caracteres.`;
  return null;
}

/** Fila da caixa de quem aprova: dúvidas no topo, depois entregas para aprovar; dentro de cada grupo, por prazo. */
export function filaDeAprovacao(demandas: readonly DemandaVisivel[]): DemandaVisivel[] {
  return demandas
    .filter((d) => d.pode_responder_duvida || d.pode_avaliar)
    .sort((a, b) => Number(b.duvida_aberta) - Number(a.duvida_aberta) || a.prazo.localeCompare(b.prazo) || a.codigo.localeCompare(b.codigo));
}

// ---------- matriz do projeto ----------

export interface PessoaDaMatriz {
  id: string;
  nome: string;
}

export interface LinhaDaMatriz {
  demanda: DemandaVisivel;
  /** Papel de cada pessoa da matriz nesta demanda (ausente = sem papel). */
  papeis: Record<string, PapelNaRaci>;
}

export interface MatrizRaci {
  pessoas: PessoaDaMatriz[];
  linhas: LinhaDaMatriz[];
}

const PESO_DO_PAPEL: Record<PapelNaRaci, number> = { 'A/R': 0, A: 1, R: 2, I: 3 };

/**
 * Matriz RACI do projeto: uma linha por demanda (abertas primeiro, por prazo) e uma coluna por pessoa que aparece
 * em alguma. As colunas começam por quem mais aprova, depois quem mais executa e, por último, quem só é informado.
 */
export function montarMatriz(demandas: readonly DemandaVisivel[], nomeDe: (id: string) => string): MatrizRaci {
  const ordenadas = [...demandas].sort((a, b) =>
    Number(a.status === 'concluida') - Number(b.status === 'concluida') || a.prazo.localeCompare(b.prazo) || a.codigo.localeCompare(b.codigo));
  const melhorPapel = new Map<string, number>();
  const linhas = ordenadas.map((demanda) => {
    const papeis: Record<string, PapelNaRaci> = {};
    for (const id of new Set([...demanda.executores, ...(demanda.aprovador_id ? [demanda.aprovador_id] : []), ...demanda.informados])) {
      const papel = papelNaRaci(demanda, id);
      if (!papel) continue;
      papeis[id] = papel;
      melhorPapel.set(id, Math.min(melhorPapel.get(id) ?? 9, PESO_DO_PAPEL[papel]));
    }
    return { demanda, papeis };
  });
  const pessoas = [...melhorPapel.keys()]
    .map((id) => ({ id, nome: nomeDe(id) }))
    .sort((a, b) => (melhorPapel.get(a.id) ?? 9) - (melhorPapel.get(b.id) ?? 9) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { pessoas, linhas };
}
