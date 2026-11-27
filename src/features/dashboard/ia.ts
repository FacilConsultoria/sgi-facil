// Resumo semanal com a IA que a pessoa já usa (Claude, Gemini), sem custo: o SGI monta o pedido com as demandas que
// quem consulta já enxerga (sem dados pessoais) para colar no chat. Função pura, sem acesso a dados.
import { NOME_DO_STATUS, estaAtrasada } from '../demandas/regras';
import type { DemandaVisivel } from '../../types/database';

const COM_QUEM: Record<DemandaVisivel['com_quem'], string> = { executores: 'quem executa', aprovador: 'quem aprova', ninguem: '-' };

/** Só as demandas abertas, uma por linha, separadas por ponto e vírgula. */
export function montarPedidoDoResumo(demandas: readonly DemandaVisivel[], nomeDe: (id: string) => string, hoje: string): string {
  const abertas = demandas.filter((d) => d.status !== 'concluida').sort((a, b) => a.prazo.localeCompare(b.prazo));
  const linhas = abertas.map((d) => [
    d.codigo, d.titulo, d.projeto_nome, NOME_DO_STATUS[d.status], d.prazo,
    d.executores.map(nomeDe).join(', ') || '-', d.aprovador_id ? nomeDe(d.aprovador_id) : '-',
    d.duvida_aberta ? 'dúvida aberta' : COM_QUEM[d.com_quem], estaAtrasada(d, hoje) ? 'atrasada' : '',
  ].map((campo) => campo.replace(/;/g, ',')).join(';'));
  return [
    'Você vai escrever o resumo semanal das demandas de uma diretoria da Fácil Consultoria (empresa júnior).',
    `Hoje é ${hoje}. Abaixo, as demandas abertas, uma por linha:`,
    'código;título;projeto;etapa;prazo;quem executa;quem aprova;com quem está;situação',
    ...linhas,
    '',
    'Escreva em português, direto, em até 250 palavras, com estes tópicos:',
    '1. Atrasadas e as que vencem nos próximos 7 dias.',
    '2. Entregas paradas: aguardando aprovação ou com dúvida aberta.',
    '3. Quem está com mais demandas abertas.',
    '4. Três prioridades sugeridas para a semana.',
    'Não invente informações que não estejam na lista.',
  ].join('\n');
}
