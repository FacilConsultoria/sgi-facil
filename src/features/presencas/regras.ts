// Regras de apresentação do módulo de Presenças. Funções puras, sem acesso a dados.
// Quem aparece na lista é decisão do banco (função frequencia()); aqui só se calcula e ordena.
import type { FrequenciaDaPessoa } from '../../types/database';

/** Percentual de presenças entre as reuniões convocadas, arredondado; nulo quando a pessoa ainda não foi convocada. */
export function taxaDeFrequencia(linha: Pick<FrequenciaDaPessoa, 'convocacoes' | 'presencas'>): number | null {
  return linha.convocacoes > 0 ? Math.round((linha.presencas / linha.convocacoes) * 100) : null;
}

/** "75%" ou "–" quando não há convocação. */
export function descreverTaxa(taxa: number | null): string {
  return taxa === null ? '–' : `${taxa}%`;
}

/** Das menores taxas para as maiores (quem precisa de atenção primeiro); sem convocação por último; empate por nome. */
export function ordenarPorFrequencia(linhas: readonly FrequenciaDaPessoa[]): FrequenciaDaPessoa[] {
  const chave = (linha: FrequenciaDaPessoa): number => taxaDeFrequencia(linha) ?? Number.POSITIVE_INFINITY;
  return [...linhas].sort((a, b) => {
    const diferenca = chave(a) - chave(b);
    return diferenca === 0 || Number.isNaN(diferenca) ? a.nome.localeCompare(b.nome, 'pt-BR') : diferenca;
  });
}

/** Frase do cabeçalho: quem só enxerga a si mesma vê "sua" frequência. */
export function introducaoDaFrequencia(linhas: readonly FrequenciaDaPessoa[], meuId: string): string {
  const soEu = linhas.length === 1 && linhas[0]?.pessoa_id === meuId;
  return soEu
    ? 'Sua frequência nas reuniões encerradas.'
    : 'Frequência das pessoas que você acompanha nas reuniões encerradas, das menores taxas para as maiores.';
}
