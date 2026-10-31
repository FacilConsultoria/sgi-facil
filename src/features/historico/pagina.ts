// Histórico completo: tudo o que foi registrado no escopo de quem consulta (criação, edição, pontos, reuniões,
// decisões de acesso), dos mais recentes para os mais antigos, com busca e "Carregar mais".
import { dataEHora } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import type { RegistroDoHistorico } from '../../types/database';
import { el, substituir } from '../../ui/dom';
import { carregarHistorico } from './dados';
import { cursorDaProximaPagina, descreverAtor, haMaisRegistros } from './regras';

const ESPERA_DA_BUSCA_EM_MS = 300;

export function paginaHistorico(destino: HTMLElement): void {
  const busca = el('input', { type: 'search', id: 'busca-historico', placeholder: 'Buscar por pessoa, ação ou código', autocomplete: 'off' });
  const lista = el('div', { class: 'bloco historico' });
  const maisRegistros = el('button', { type: 'button', class: 'btn', hidden: true }, 'Carregar mais');
  const erro = el('p', { class: 'mensagem-form erro', role: 'alert' });

  let registros: RegistroDoHistorico[] = [];
  let haMais = false;
  // cada busca ganha um número; respostas de buscas antigas são descartadas
  let pedido = 0;
  let temporizador: number | undefined;

  const desenhar = (carregando: boolean): void => {
    if (carregando && registros.length === 0) substituir(lista, el('p', { class: 'meta' }, 'Carregando histórico…'));
    else if (registros.length === 0) substituir(lista, el('p', { class: 'vazio' }, 'Nada encontrado.'));
    else {
      substituir(lista, el('ul', { class: 'hist' }, ...registros.map((registro) =>
        el('li', {},
          el('time', { datetime: registro.em }, dataEHora(registro.em)),
          el('span', {}, el('strong', {}, descreverAtor(registro)), ` · ${registro.acao}: ${registro.detalhe}`)))));
    }
    maisRegistros.hidden = !haMais;
    maisRegistros.disabled = carregando;
  };

  const carregar = async (continuar: boolean): Promise<void> => {
    const meu = ++pedido;
    erro.textContent = '';
    if (!continuar) {
      registros = [];
      haMais = false;
    }
    desenhar(true);
    try {
      const pagina = await carregarHistorico(busca.value, continuar ? cursorDaProximaPagina(registros) : null);
      if (meu !== pedido || !destino.isConnected) return;
      registros = [...registros, ...pagina];
      haMais = haMaisRegistros(pagina.length);
    } catch (falha: unknown) {
      if (meu !== pedido) return;
      registrarErro('Carregar histórico', falha);
      erro.textContent = mensagemParaUsuario(falha);
      haMais = false;
    }
    desenhar(false);
  };

  busca.addEventListener('input', () => {
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => void carregar(false), ESPERA_DA_BUSCA_EM_MS);
  });
  maisRegistros.addEventListener('click', () => void carregar(true));

  substituir(destino,
    el('section', { class: 'cab' },
      el('div', {},
        el('h1', {}, 'Histórico completo'),
        el('p', { class: 'sub' }, 'Toda criação, edição, lançamento de pontos, reunião e decisão de acesso fica registrada. Você vê os registros do seu escopo.'))),
    el('div', { class: 'busca' }, el('label', { for: busca.id, class: 'sr' }, 'Buscar no histórico'), busca),
    erro, lista,
    el('div', { class: 'linha acima' }, maisRegistros));
  void carregar(false);
}
