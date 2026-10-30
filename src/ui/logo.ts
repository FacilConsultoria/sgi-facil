// Símbolo da Fácil Consultoria em SVG, na cor do texto ao redor.
// Geometria simétrica em torno do eixo x = 539,5: as quatro faces são espelhadas
// e a esfera fica exatamente sobre o eixo. A área de desenho (viewBox) é rente ao
// símbolo, sem margens, para que alinhamentos usem o desenho real.
const SVG = 'http://www.w3.org/2000/svg';
const EIXO_DO_SIMBOLO = 539.5;

export function criarSimbolo(classe = 'logo'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '338 213 403 273');
  svg.setAttribute('class', classe);
  svg.setAttribute('aria-hidden', 'true');
  const esfera = document.createElementNS(SVG, 'circle');
  esfera.setAttribute('cx', String(EIXO_DO_SIMBOLO));
  esfera.setAttribute('cy', '256');
  esfera.setAttribute('r', '43');
  const faces = document.createElementNS(SVG, 'path');
  faces.setAttribute('d', 'M452 279 536 319 536 391 452 351Z M543 319 627 279 627 351 543 391Z M338 320 536 413 536 486 338 392Z M543 413 741 320 741 392 543 486Z');
  svg.append(esfera, faces);
  return svg;
}
