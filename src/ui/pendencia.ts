// Ícone de pendência: um balão com um triângulo de atenção. A cor diz o estado:
//   ok (verde)      dentro do prazo
//   proximo (âmbar) perto do prazo da entrega (até 48 h)
//   atrasado (vermelho) depois do prazo
// Hoje serve para "dados pessoais pendentes"; o mesmo ícone é o das entregas atribuídas.
const NS = 'http://www.w3.org/2000/svg';

export type EstadoDePendencia = 'ok' | 'proximo' | 'atrasado';

function no(tag: string, atributos: Record<string, string>): SVGElement {
  const elemento = document.createElementNS(NS, tag);
  for (const [nome, valor] of Object.entries(atributos)) elemento.setAttribute(nome, valor);
  return elemento;
}

/** `titulo` é lido por leitores de tela e aparece ao passar o mouse. */
export function iconeDePendencia(estado: EstadoDePendencia, titulo: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  // desenho em 100 × 100: balão de contorno grosso (aberto no alto, com a ponta embaixo à esquerda) e um triângulo
  // grande de cantos arredondados no meio, com a exclamação em creme, como no desenho de referência
  svg.setAttribute('viewBox', '0 6 100 82');
  svg.setAttribute('class', `pendencia pendencia-${estado}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', titulo);
  const nomeDoIcone = document.createElementNS(NS, 'title');
  nomeDoIcone.textContent = titulo;
  svg.append(
    nomeDoIcone,
    no('path', { class: 'balao', d: 'M50 12H80a12 12 0 0 1 12 12V58a12 12 0 0 1-12 12H32L8 80V24a12 12 0 0 1 12-12H30', fill: 'none', 'stroke-width': '8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    no('path', { class: 'triangulo', d: 'M50 22 68 56H32z', 'stroke-width': '7', 'stroke-linejoin': 'round' }),
    no('path', { class: 'exclamacao', d: 'M50 33v12', 'stroke-width': '5.5', 'stroke-linecap': 'round' }),
    no('circle', { class: 'ponto', cx: '50', cy: '51.5', r: '3.4' }),
  );
  return svg;
}
