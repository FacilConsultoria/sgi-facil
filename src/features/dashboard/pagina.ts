// Página inicial: saudação, escopo de acesso e o que já está disponível.
// Os números do painel (pontos, demandas, reuniões) entram junto com os módulos migrados.
import type { ContextoDaSessao } from '../../app/sessao';
import { descreverEscopo, primeiroNome } from '../../lib/perfil';
import { el, substituir } from '../../ui/dom';

export function paginaDashboard(destino: HTMLElement, contexto: ContextoDaSessao): void {
  const { perfil, tituloDaArea } = contexto;
  const permissoes = [
    perfil.pode_cadastrar_pessoas && 'cadastrar pessoas',
    perfil.pode_ajustar_pontos && 'ajustar pontuações',
    perfil.pode_editar_regras && 'alterar as regras de pontuação',
  ].filter((item): item is string => Boolean(item));

  substituir(destino,
    el('section', { class: 'cab' },
      el('div', {},
        el('h1', {}, `Olá, ${primeiroNome(perfil.nome)}`),
        el('p', { class: 'sub' }, descreverEscopo(perfil, tituloDaArea)))),
    el('section', { class: 'bloco' },
      el('h2', {}, 'O SGI está chegando por partes'),
      el('p', {}, 'Os módulos estão sendo trazidos do protótipo para a versão online. Demandas, Reuniões e atas, Presenças, Pontuação e ranking, Estrutura e equipe, Histórico completo, Regras e Autorizações já estão disponíveis; os itens marcados como “em breve” no menu ainda não.'),
      permissoes.length
        ? el('p', { class: 'meta' }, `Seu perfil também permite ${permissoes.join(', ')}.`)
        : null),
  );
}
