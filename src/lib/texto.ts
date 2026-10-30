// Pequenos auxiliares de texto em português.

/** plural(1, 'falta', 'faltas') → "1 falta"; plural(2, ...) → "2 faltas". */
export function plural(quantidade: number, singular: string, pluralizado: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : pluralizado}`;
}

/** Quantidade de palavras de um texto. */
export function contarPalavras(texto: string): number {
  const limpo = texto.trim();
  return limpo ? limpo.split(/\s+/).length : 0;
}
