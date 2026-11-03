// Regras de apresentação do sino de notificações. Funções puras, sem acesso a dados.
// O que entra no sino (atrasos, atividades atribuídas e recados) já vem decidido pela visão minhas_notificacoes.
import { dataCurta, diasAte } from '../../lib/datas';
import type { Notificacao, TipoDeNotificacao } from '../../types/database';

export const LIMITE_DO_CONTADOR = 99;

/** O número ao lado do sino: "7" ou, de cem para cima, "99+". */
export function textoDoContador(total: number): string {
  return total > LIMITE_DO_CONTADOR ? `${LIMITE_DO_CONTADOR}+` : String(total);
}

/** Nome do botão para leitores de tela. */
export function rotuloDoSino(total: number): string {
  if (total === 0) return 'Notificações: nenhuma nova';
  return total === 1 ? 'Notificações: 1 nova' : `Notificações: ${total} novas`;
}

/** Atrasos primeiro (o mais antigo no topo); depois o que chegou, do mais recente para trás. */
export function ordenarNotificacoes(lista: readonly Notificacao[]): Notificacao[] {
  const atrasos = lista.filter((n) => n.tipo === 'atraso')
    .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '') || (a.codigo ?? '').localeCompare(b.codigo ?? ''));
  const demais = lista.filter((n) => n.tipo !== 'atraso').sort((a, b) => b.em.localeCompare(a.em));
  return [...atrasos, ...demais];
}

export const NOME_DO_TIPO_DE_NOTIFICACAO: Readonly<Record<TipoDeNotificacao, string>> = {
  atraso: 'Atraso',
  atribuicao: 'Nova atividade',
  recado: 'Recado',
};

/** "Venceu ontem · 05/11" ou "Atrasada há 3 dias · 05/11". */
export function descreverAtraso(prazo: string, hoje: string): string {
  const dias = Math.max(1, diasAte(prazo, hoje));
  return dias === 1 ? `Venceu ontem · ${dataCurta(prazo)}` : `Atrasada há ${dias} dias · ${dataCurta(prazo)}`;
}

export interface TextoDaNotificacao {
  titulo: string;
  detalhe: string;
}

export function descreverNotificacao(notificacao: Notificacao, hoje: string): TextoDaNotificacao {
  const demanda = notificacao.codigo ? `${notificacao.codigo} · ${notificacao.titulo}` : notificacao.titulo;
  switch (notificacao.tipo) {
    case 'atraso':
      return { titulo: demanda, detalhe: notificacao.prazo ? descreverAtraso(notificacao.prazo, hoje) : 'Prazo vencido' };
    case 'atribuicao':
      return { titulo: demanda, detalhe: notificacao.prazo ? `Atribuída a você · prazo ${dataCurta(notificacao.prazo)}` : 'Atribuída a você' };
    case 'recado':
      return { titulo: notificacao.titulo, detalhe: notificacao.autor_nome ? `Recado de ${notificacao.autor_nome}` : 'Recado interno' };
  }
}

/** As que podem ser marcadas como lidas (atrasos somem sozinhos quando a demanda é concluída). */
export function idsParaMarcar(lista: readonly Notificacao[]): string[] {
  return lista.flatMap((n) => (n.id ? [n.id] : []));
}
