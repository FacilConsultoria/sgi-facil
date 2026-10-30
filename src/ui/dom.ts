// Criação de elementos sem innerHTML: todo texto entra como nó de texto,
// o que impede injeção de HTML a partir de dados do banco (diretrizes §8.2).

export type Filho = Node | string | number | null | undefined | false;
export type Atributos = Record<string, string | boolean | undefined>;

export function el<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  atributos: Atributos = {},
  ...filhos: Filho[]
): HTMLElementTagNameMap[Tag] {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === false) continue;
    elemento.setAttribute(nome, valor === true ? '' : valor);
  }
  anexar(elemento, filhos);
  return elemento;
}

export function anexar(pai: Element, filhos: Filho[]): void {
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === false) continue;
    pai.append(typeof filho === 'number' ? String(filho) : filho);
  }
}

/** Troca todo o conteúdo de um elemento. */
export function substituir(pai: Element, ...filhos: Filho[]): void {
  pai.replaceChildren();
  anexar(pai, filhos);
}
