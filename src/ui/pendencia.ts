// Ícone de pendência: um triângulo de atenção, liso e de cantos arredondados, com uma exclamação. A cor diz o estado:
//   ok (verde)      dentro do prazo
//   proximo (âmbar) perto do prazo da entrega (até 48 h)
//   atrasado (vermelho) depois do prazo
// Serve para "dados pessoais pendentes" e para o prazo das entregas atribuídas.
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
  svg.setAttribute('viewBox', '4 6 92 80');
  svg.setAttribute('class', `pendencia pendencia-${estado}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', titulo);
  const nomeDoIcone = document.createElementNS(NS, 'title');
  nomeDoIcone.textContent = titulo;
  svg.append(
    nomeDoIcone,
    // o contorno na cor do preenchimento só serve para arredondar os cantos
    no('path', { class: 'triangulo', d: 'M50 15 88 80H12z', 'stroke-width': '9', 'stroke-linejoin': 'round' }),
    no('path', { class: 'exclamacao', d: 'M50 38v19', 'stroke-width': '7.5', 'stroke-linecap': 'round' }),
    no('circle', { class: 'ponto', cx: '50', cy: '68', r: '4.6' }),
  );
  return svg;
}
