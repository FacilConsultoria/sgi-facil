// Como o sistema se refere a quem ocupa a Presidência e a Vice-Presidência ("a Presidente", "o Vice-Presidente").
// Cada pessoa informa o gênero no formulário de dados pessoais; o banco guarda só a forma de tratamento
// (feminino, masculino ou neutro) na coluna pessoas.tratamento, que todas as pessoas podem ler. O gênero em si
// continua privado. Sem tratamento informado, o texto usa o nome do cargo ("a Presidência"), sem presumir nada.
export type Tratamento = 'feminino' | 'masculino' | 'neutro';
export type CargoDaPresidencia = 'presidente' | 'vice';

const NOME_DO_CARGO: Record<CargoDaPresidencia, Record<Tratamento, string>> = {
  presidente: { feminino: 'Presidente', masculino: 'Presidente', neutro: 'Presidência' },
  vice: { feminino: 'Vice-Presidente', masculino: 'Vice-Presidente', neutro: 'Vice-Presidência' },
};

let atuais: Record<CargoDaPresidencia, Tratamento> = { presidente: 'neutro', vice: 'neutro' };

/** Qualquer valor que não seja "feminino" ou "masculino" vira neutro. */
export function tratamentoValido(valor: unknown): Tratamento {
  return valor === 'feminino' || valor === 'masculino' ? valor : 'neutro';
}

/** Guarda o tratamento de quem ocupa cada cargo agora (chamado ao carregar a sessão). Pessoas desativadas não contam. */
export function definirTratamentos(pessoas: readonly { papel?: unknown; tratamento?: unknown; ativo?: unknown }[]): void {
  const de = (papel: CargoDaPresidencia): Tratamento =>
    tratamentoValido(pessoas.find((p) => p.papel === papel && p.ativo !== false)?.tratamento);
  atuais = { presidente: de('presidente'), vice: de('vice') };
}

/** "a Presidente", "o Vice-Presidente" ou, sem tratamento informado, "a Presidência". Com "de": "da"/"do"; com "a": "à"/"ao". */
export function cargo(papel: CargoDaPresidencia, preposicao: '' | 'de' | 'a' = ''): string {
  const tratamento = atuais[papel];
  const masculino = tratamento === 'masculino';
  const artigo = preposicao === 'de' ? (masculino ? 'do' : 'da') : preposicao === 'a' ? (masculino ? 'ao' : 'à') : masculino ? 'o' : 'a';
  return `${artigo} ${NOME_DO_CARGO[papel][tratamento]}`;
}

/** "da Presidente ou do Vice-Presidente" (com "de"), "a Presidente ou o Vice-Presidente" (sem preposição). */
export function presidenteOuVice(preposicao: '' | 'de' | 'a' = ''): string {
  return `${cargo('presidente', preposicao)} ou ${cargo('vice', preposicao)}`;
}

/** Para começar frase: "a Presidente ou o Vice-Presidente" → "A Presidente ou o Vice-Presidente". */
export function comInicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
