// Regras de apresentação do módulo Regras. Funções puras, sem acesso a dados.
// O que cada perfil pode fazer (quadro abaixo) é texto de apoio, escrito conforme as regras que o banco aplica
// (supabase/01 a 12); quem pode salvar os valores de pontuação vem do indicador pode_editar_regras do perfil.
import type { AreaDaEstrutura, LinhaDaSimulacao, RegrasDePontuacao } from '../../types/database';

export const LIMITE_DOS_VALORES = 50;

export type ChaveDePontos = Exclude<keyof RegrasDePontuacao, 'ranking_publico'>;

export const CAMPOS_DE_PONTOS: readonly { chave: ChaveDePontos; rotulo: string }[] = [
  { chave: 'pontos_iniciais', rotulo: 'Pontos iniciais' },
  { chave: 'entrega_no_prazo', rotulo: 'Entrega no prazo' },
  { chave: 'entrega_atrasada', rotulo: 'Entrega com atraso' },
  { chave: 'falta', rotulo: 'Falta em reunião' },
  { chave: 'falta_justificada', rotulo: 'Falta justificada' },
];

/** Texto digitado em cada campo, por chave. */
export type ValoresDigitados = Record<ChaveDePontos, string>;

/** Checagem antes de enviar, com a mesma mensagem do banco (que confere de novo): inteiros de −50 a 50. */
export function validarRegrasDePontos(valores: ValoresDigitados): string | null {
  for (const { chave } of CAMPOS_DE_PONTOS) {
    const texto = valores[chave].trim();
    const numero = Number(texto);
    if (texto === '' || !Number.isInteger(numero) || Math.abs(numero) > LIMITE_DOS_VALORES) {
      return `Use números inteiros entre −${LIMITE_DOS_VALORES} e ${LIMITE_DOS_VALORES}.`;
    }
  }
  return null;
}

export function valoresParaOsCampos(regras: RegrasDePontuacao): ValoresDigitados {
  return {
    pontos_iniciais: String(regras.pontos_iniciais),
    entrega_no_prazo: String(regras.entrega_no_prazo),
    entrega_atrasada: String(regras.entrega_atrasada),
    falta: String(regras.falta),
    falta_justificada: String(regras.falta_justificada),
  };
}

export interface PerfilDeAcesso {
  perfil: string;
  demandas: string;
  pontuacao: string;
  restritos: string;
  criarEValidar: string;
  ajustarPontos: string;
  aprovarExcecoes: string;
}

export const ROTULOS_DO_QUADRO: Readonly<Record<Exclude<keyof PerfilDeAcesso, 'perfil'>, string>> = {
  demandas: 'Demandas',
  pontuacao: 'Pontuação detalhada',
  restritos: 'Restritos da Presidência',
  criarEValidar: 'Criar e validar',
  ajustarPontos: 'Ajustar pontos',
  aprovarExcecoes: 'Aprovar exceções de acesso',
};

export const PERFIS_DE_ACESSO: readonly PerfilDeAcesso[] = [
  {
    perfil: 'Presidente',
    demandas: 'Todas',
    pontuacao: 'Todas as pessoas',
    restritos: 'Sim',
    criarEValidar: 'Qualquer projeto',
    ajustarPontos: 'Sim, menos a própria pontuação',
    aprovarExcecoes: 'Qualquer área, inclusive itens restritos. Também revoga acessos e dá aval.',
  },
  {
    perfil: 'Vice-Presidente',
    demandas: 'Todas',
    pontuacao: 'Todas as pessoas',
    restritos: 'Sim',
    criarEValidar: 'Qualquer projeto',
    ajustarPontos: 'Sim, menos a própria pontuação',
    aprovarExcecoes: 'Só das áreas que conduz, sem itens restritos. Dá aval.',
  },
  {
    perfil: 'Assessoria de Presidência',
    demandas: 'Todas',
    pontuacao: 'Todas as pessoas',
    restritos: 'Sim',
    criarEValidar: 'Qualquer projeto',
    ajustarPontos: 'Sim; na própria pontuação, só com aval da Presidente ou da Vice',
    aprovarExcecoes: 'Só com aval da Presidente ou da Vice',
  },
  {
    perfil: 'Diretoria',
    demandas: 'As das áreas que conduz, inclusive as cobertas por vacância',
    pontuacao: 'As pessoas dessas áreas',
    restritos: 'Não',
    criarEValidar: 'Projetos dessas áreas',
    ajustarPontos: 'Só a Diretoria Administrativa (Gente e Gestão)',
    aprovarExcecoes: 'Projetos e demandas das áreas que conduz, sem itens restritos',
  },
  {
    perfil: 'Gerência',
    demandas: 'As do núcleo',
    pontuacao: 'As pessoas do núcleo',
    restritos: 'Não',
    criarEValidar: 'Projetos do núcleo',
    ajustarPontos: 'Só a gerência de Gente e Gestão',
    aprovarExcecoes: 'Não. Pode pedir acesso para a equipe do núcleo.',
  },
  {
    perfil: 'Membro',
    demandas: 'Só aquelas em que é executor',
    pontuacao: 'Só a própria',
    restritos: 'Não',
    criarEValidar: 'Move as próprias demandas até "Em revisão"',
    ajustarPontos: 'Não',
    aprovarExcecoes: 'Não. Pode pedir acesso para si.',
  },
];

export const PASSOS_DA_EXCECAO: readonly { destaque: string; texto: string }[] = [
  { destaque: 'Pedido formal prévio', texto: 'feito pela pessoa ou pela sua liderança, com justificativa.' },
  { destaque: 'Escopo pontual', texto: 'um projeto inteiro ou uma única demanda, identificada pelo código.' },
  { destaque: 'Aprovação expressa', texto: 'da Presidente ou da diretoria que conduz a área. Itens restritos só a Presidente aprova. Ninguém aprova o próprio pedido.' },
  { destaque: 'Prazo de até 90 dias', texto: 'com expiração automática. A liberação é só para consulta e pode ser revogada.' },
  { destaque: 'Atribuição formal', texto: 'ser executor de uma demanda sempre dá acesso a ela.' },
];

export interface LinhaDeArea {
  id: string;
  area: string;
  responsavel: string;
  /** Área sem titular. */
  vaga: boolean;
}

/** Quem responde por cada área: o titular, ou "Vaga · coberta por Fulano", ou "Vaga". Presidência primeiro. */
export function situacaoDasAreas(
  areas: readonly AreaDaEstrutura[],
  nomeDe: (pessoaId: string) => string | undefined,
): LinhaDeArea[] {
  return [...areas]
    .sort((a, b) => Number(b.area_da_presidencia) - Number(a.area_da_presidencia) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
    .map((area) => {
      const titular = area.titular ? nomeDe(area.titular) : undefined;
      const cobertura = area.cobertura ? nomeDe(area.cobertura) : undefined;
      const responsavel = titular ?? (cobertura ? `Vaga · coberta por ${cobertura}` : 'Vaga');
      return { id: area.id, area: area.titulo, responsavel, vaga: titular === undefined };
    });
}

/** "3" ou "–" quando não há nenhuma. */
export function descreverQuantidade(quantidade: number): string {
  return quantidade === 0 ? '–' : String(quantidade);
}

/** Frase do cabeçalho da seção de simulação. */
export function introducaoDaSimulacao(linhas: readonly LinhaDaSimulacao[]): string {
  const total = linhas[0]?.total_demandas ?? 0;
  return `Quantas das ${total} demandas e quantas pontuações cada pessoa enxerga com os dados de agora.`;
}
