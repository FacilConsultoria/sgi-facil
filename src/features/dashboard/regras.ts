// Regras de apresentação da Tela Inicial. Funções puras, sem acesso a dados.
// Permissões não são calculadas aqui: pode_gerir (demandas) e pode_aprovar (pedidos de acesso) chegam prontos
// das visões do banco; o que a pessoa enxerga já vem filtrado pela RLS.
import { dataCurta, diasAte, horaCurta, hojeEmSaoPaulo } from '../../lib/datas';
import type {
  DemandaVisivel, DestinoDeRecado, EscopoDeRecado, LancamentoVisivel, LinhaDoRanking, RecadoDoPainel, ReuniaoVisivel, SolicitacaoVisivel,
} from '../../types/database';
import { separarSolicitacoes } from '../acessos/regras';
import { estaAtrasada } from '../demandas/regras';
import { posicaoNoRanking } from '../pontuacao/regras';

export const LIMITE_DE_ENTREGAS = 6;
export const LIMITE_DE_REUNIOES = 5;
export const LIMITE_DE_LANCAMENTOS = 5;

const porPrazo = (a: DemandaVisivel, b: DemandaVisivel): number => a.prazo.localeCompare(b.prazo) || a.codigo.localeCompare(b.codigo);

/** Demandas abertas em que a pessoa é executora, da que vence primeiro para a última. */
export function minhasDemandasAbertas(demandas: readonly DemandaVisivel[], meuId: string): DemandaVisivel[] {
  return demandas.filter((d) => d.status !== 'concluida' && d.executores.includes(meuId)).sort(porPrazo);
}

/** Demandas em revisão que a pessoa pode validar (o indicador pode_gerir vem do banco). */
export function aguardandoValidacao(demandas: readonly DemandaVisivel[]): DemandaVisivel[] {
  return demandas.filter((d) => d.status === 'revisao' && d.pode_gerir).sort(porPrazo);
}

/** "05/11" ou, vencida, "Atrasada · 05/11". */
export function descreverPrazo(demanda: Pick<DemandaVisivel, 'status' | 'prazo'>, hoje: string): string {
  const data = dataCurta(demanda.prazo);
  return estaAtrasada(demanda, hoje) ? `Atrasada · ${data}` : data;
}

/** Reuniões que ainda vão acontecer (hoje inclusive), da mais próxima para a mais distante. */
export function proximasReunioes(reunioes: readonly ReuniaoVisivel[], hoje: string): ReuniaoVisivel[] {
  return reunioes
    .filter((r) => !r.encerrada && r.data >= hoje)
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
}

/** "05/11 · 19:00". */
export function descreverQuando(reuniao: Pick<ReuniaoVisivel, 'data' | 'hora'>): string {
  return `${dataCurta(reuniao.data)} · ${horaCurta(reuniao.hora)}`;
}

/** Últimos lançamentos que valem (os desconsiderados ficam de fora), do mais recente para trás. */
export function ultimosLancamentos(lancamentos: readonly LancamentoVisivel[], limite = LIMITE_DE_LANCAMENTOS): LancamentoVisivel[] {
  return lancamentos
    .filter((l) => l.desconsiderado_em === null)
    .sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em))
    .slice(0, limite);
}

/** Pedidos de acesso que a pessoa decide agora ou, na Assessoria, pede aval para decidir; os mais antigos primeiro. */
export function pedidosParaDecidir(solicitacoes: readonly SolicitacaoVisivel[]): SolicitacaoVisivel[] {
  return separarSolicitacoes(solicitacoes).paraDecidir;
}

/** "até 05/11", para o pedido de acesso. */
export function descreverValidadeDoPedido(solicitacao: Pick<SolicitacaoVisivel, 'valido_ate'>): string {
  return `até ${dataCurta(solicitacao.valido_ate)}`;
}

export const LIMITE_DE_RECADOS = 5;
export const DIAS_DE_RECADO_NA_TELA = 30;
export const LIMITE_DO_TITULO_DO_RECADO = 80;
export const LIMITE_DO_TEXTO_DO_RECADO = 1000;

/** Recados dos últimos 30 dias, do mais novo para o mais antigo (os mais velhos continuam no banco, só saem da tela). */
export function recadosRecentes(recados: readonly RecadoDoPainel[], hoje: string, limite = LIMITE_DE_RECADOS): RecadoDoPainel[] {
  return recados
    .filter((r) => diasAte(hojeEmSaoPaulo(new Date(r.criado_em)), hoje) <= DIAS_DE_RECADO_NA_TELA)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .slice(0, limite);
}

/** "Mel · Toda a equipe · 05/11". */
export function descreverRecado(recado: Pick<RecadoDoPainel, 'autor_nome' | 'publico' | 'criado_em'>): string {
  return `${recado.autor_nome} · ${recado.publico} · ${dataCurta(hojeEmSaoPaulo(new Date(recado.criado_em)))}`;
}

/** Nome do destino na lista de escolha: "Toda a equipe", "Área · Diretoria Comercial" ou "Núcleo · Marketing". */
export function rotuloDoDestino(destino: Pick<DestinoDeRecado, 'escopo' | 'nome'>): string {
  if (destino.escopo === 'area') return `Área · ${destino.nome}`;
  if (destino.escopo === 'nucleo') return `Núcleo · ${destino.nome}`;
  return destino.nome;
}

/** Valor da opção na lista de escolha: "todos:", "area:com" ou "nucleo:com-mkt". */
export function valorDoDestino(destino: Pick<DestinoDeRecado, 'escopo' | 'escopo_id'>): string {
  return `${destino.escopo}:${destino.escopo_id ?? ''}`;
}

export function lerDestino(valor: string): { escopo: EscopoDeRecado; escopoId: string | null } | null {
  const [escopo, ...resto] = valor.split(':');
  if (escopo !== 'todos' && escopo !== 'area' && escopo !== 'nucleo') return null;
  const escopoId = resto.join(':');
  if (escopo !== 'todos' && escopoId === '') return null;
  return { escopo, escopoId: escopo === 'todos' ? null : escopoId };
}

export interface RecadoDigitado {
  titulo: string;
  texto: string;
  destino: string;
}

/** Mensagem do primeiro problema do recado, ou null se pode enviar. As mesmas regras valem no banco. */
export function validarRecado(recado: RecadoDigitado): string | null {
  if (lerDestino(recado.destino) === null) return 'Escolha para quem é o recado.';
  const titulo = recado.titulo.trim();
  if (titulo === '') return 'Dê um título ao recado.';
  if (titulo.length > LIMITE_DO_TITULO_DO_RECADO) return `O título pode ter até ${LIMITE_DO_TITULO_DO_RECADO} caracteres.`;
  const texto = recado.texto.trim();
  if (texto === '') return 'Escreva o recado.';
  if (texto.length > LIMITE_DO_TEXTO_DO_RECADO) return `O recado pode ter até ${LIMITE_DO_TEXTO_DO_RECADO} caracteres.`;
  return null;
}

export interface Indicador {
  titulo: string;
  valor: string;
  detalhe: string;
  alerta: boolean;
}

export interface EntradaDosIndicadores {
  minhas: readonly DemandaVisivel[];
  ranking: readonly LinhaDoRanking[];
  proximas: readonly ReuniaoVisivel[];
  meuId: string;
  hoje: string;
}

/** Os quatro números do topo: pontos e posição, demandas abertas, atrasadas e a próxima reunião. */
export function indicadoresDoInicio(entrada: EntradaDosIndicadores): Indicador[] {
  const { minhas, ranking, proximas, meuId, hoje } = entrada;
  const linha = ranking.find((l) => l.pessoa_id === meuId);
  const posicao = posicaoNoRanking(ranking, meuId);
  const atrasadas = minhas.filter((d) => estaAtrasada(d, hoje)).length;
  const emRevisao = minhas.filter((d) => d.status === 'revisao').length;
  const proxima = proximas[0];
  return [
    {
      titulo: 'Seus pontos',
      valor: linha ? String(linha.pontos) : '–',
      detalhe: posicao ? `${posicao.posicao}º no ranking` : 'Fora do ranking visível',
      alerta: false,
    },
    { titulo: 'Suas demandas abertas', valor: String(minhas.length), detalhe: `${emRevisao} em revisão`, alerta: false },
    { titulo: 'Atrasadas', valor: String(atrasadas), detalhe: 'Prazo vencido sem conclusão', alerta: atrasadas > 0 },
    {
      titulo: 'Próxima reunião',
      valor: proxima ? dataCurta(proxima.data) : '–',
      detalhe: proxima ? proxima.titulo : 'Nenhuma agendada',
      alerta: false,
    },
  ];
}
