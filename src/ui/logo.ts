// Símbolo da Fácil Consultoria em SVG (círculo e quatro paralelogramos), na cor do texto ao redor.
const SVG = 'http://www.w3.org/2000/svg';

export function criarSimbolo(classe = 'logo'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '330 205 420 290');
  svg.setAttribute('class', classe);
  svg.setAttribute('aria-hidden', 'true');
  const circulo = document.createElementNS(SVG, 'circle');
  circulo.setAttribute('cx', '540');
  circulo.setAttribute('cy', '256');
  circulo.setAttribute('r', '43');
  const formas = document.createElementNS(SVG, 'path');
  formas.setAttribute('d', 'M452 279 536 319 536 391 452 351Z M543 319 627 279 627 351 543 391Z M338 320 536 413 536 486 338 392Z M543 413 741 320 741 392 543 486Z');
  svg.append(circulo, formas);
  return svg;
}
