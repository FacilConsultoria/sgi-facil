// Regras de apresentação do módulo Projetos. Funções puras, sem acesso a dados.
// O tipo de acesso e os números vêm prontos da visão projetos_painel; aqui só viram texto e ordem.
import { plural } from '../../lib/texto';
import type { AcessoAoProjeto, ProjetoDoPainel } from '../../types/database';

type ParaOAndamento = Pick<ProjetoDoPainel, 'total_demandas' | 'concluidas'>;

/** Percentual de demandas concluídas, de 0 a 100 (0 quando não há demanda). */
export function percentualConcluido(projeto: ParaOAndamento): number {
  return projeto.total_demandas === 0 ? 0 : Math.round((projeto.concluidas / projeto.total_demandas) * 100);
}

/** "2 de 5 demandas concluídas"; para quem vê só parte do projeto, "…visíveis concluídas". */
export function descreverAndamento(projeto: ParaOAndamento & Pick<ProjetoDoPainel, 'acesso'>): string {
  const integral = projeto.acesso === 'integral';
  if (projeto.total_demandas === 0) return integral ? 'Nenhuma demanda ainda' : 'Nenhuma demanda visível para você';
  const um = projeto.total_demandas === 1;
  const demandas = integral
    ? (um ? 'demanda concluída' : 'demandas concluídas')
    : (um ? 'demanda visível concluída' : 'demandas visíveis concluídas');
  return `${projeto.concluidas} de ${projeto.total_demandas} ${demandas}`;
}

/** "1 atrasada", "3 atrasadas"; nada quando não há. */
export function descreverAtrasadas(atrasadas: number): string | null {
  return atrasadas > 0 ? plural(atrasadas, 'atrasada', 'atrasadas') : null;
}

/** Selo do cartão: nada para quem tem o projeto pela hierarquia. */
export function seloDoAcesso(acesso: AcessoAoProjeto): { texto: string; classe: string } | null {
  switch (acesso) {
    case 'integral':
      return null;
    case 'excecao':
      return { texto: 'Exceção', classe: 'm-excecao' };
    case 'parcial':
      return { texto: 'Parcial', classe: 'm-executor' };
  }
}

/** "Diretoria Comercial · Marketing". */
export function descreverOrigem(projeto: Pick<ProjetoDoPainel, 'area_titulo' | 'nucleo_nome'>): string {
  return `${projeto.area_titulo} · ${projeto.nucleo_nome}`;
}

/** Por área e núcleo, depois por nome; encerrados por último. */
export function ordenarProjetos(projetos: readonly ProjetoDoPainel[]): ProjetoDoPainel[] {
  const comparar = (a: string, b: string): number => a.localeCompare(b, 'pt-BR');
  return [...projetos].sort((a, b) =>
    Number(b.ativo) - Number(a.ativo)
    || comparar(a.area_titulo, b.area_titulo)
    || comparar(a.nucleo_nome, b.nucleo_nome)
    || comparar(a.nome, b.nome));
}

export function introducaoDosProjetos(projetos: readonly Pick<ProjetoDoPainel, 'acesso'>[]): string {
  if (projetos.length === 0) return 'Nenhum projeto visível para o seu perfil.';
  const base = `${plural(projetos.length, 'projeto', 'projetos')} no seu escopo.`;
  return projetos.some((p) => p.acesso === 'parcial') ? `${base} “Parcial” indica que você vê só as demandas em que atua.` : base;
}
