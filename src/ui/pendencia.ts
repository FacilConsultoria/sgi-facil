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
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', `pendencia pendencia-${estado}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', titulo);
  const nomeDoIcone = document.createElementNS(NS, 'title');
  nomeDoIcone.textContent = titulo;
  svg.append(
    nomeDoIcone,
    no('path', { class: 'balao', d: 'M17 6H12a6 6 0 0 0-6 6v17a6 6 0 0 0 6 6h26a6 6 0 0 0 6-6V12a6 6 0 0 0-6-6h-5M7 35v7l8-7', fill: 'none', 'stroke-width': '3.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    no('path', { class: 'triangulo', d: 'M24 13.5 33.5 30h-19z', 'stroke-width': '3', 'stroke-linejoin': 'round' }),
    no('path', { class: 'exclamacao', d: 'M24 19.5v5', 'stroke-width': '2.6', 'stroke-linecap': 'round' }),
    no('circle', { class: 'ponto', cx: '24', cy: '27.6', r: '1.5' }),
  );
  return svg;
}
