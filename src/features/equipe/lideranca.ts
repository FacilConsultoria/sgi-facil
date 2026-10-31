// Janela "Definir liderança": titular e cobertura de uma área. Só a Presidência chega aqui (o botão depende
// do indicador pode_definir_lideranca) e o banco confere de novo.
import { tituloDoPapel } from '../../lib/perfil';
import type { AreaDaEstrutura, CandidatoALideranca } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import { definirLideranca } from './dados';

export interface ContextoDaLideranca {
  /** Onde as janelas são montadas (fora do conteúdo, que é redesenhado). */
  pagina: HTMLElement;
  candidatos: readonly CandidatoALideranca[];
  recarregar: () => Promise<void>;
}

export function abrirDefinirLideranca(contexto: ContextoDaLideranca, area: AreaDaEstrutura): void {
  abrirJanela(contexto.pagina, 'lideranca-titulo', `Liderança: ${area.titulo}`, (fechar) => {
    const opcoes = (atual: string | null, vazio: string): HTMLOptionElement[] => [
      el('option', { value: '' }, vazio),
      ...contexto.candidatos.map((c) => el('option', { value: c.id, selected: c.id === atual }, `${c.nome} · ${tituloDoPapel(c.papel)}`)),
    ];
    const titular = el('select', { id: 'ld-titular' }, ...opcoes(area.titular, 'Sem titular'));
    const cobertura = el('select', { id: 'ld-cobertura' }, ...opcoes(area.cobertura, 'Sem cobertura'));
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar');
    const erro = linhaDeErro();

    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        el('p', { class: 'dica' }, 'O titular e a cobertura são Presidente, Vice-Presidente ou diretoria. Com a área sem titular, quem estiver na cobertura responde por ela.'),
        campo('Titular', titular), campo('Cobertura (enquanto não houver titular)', cobertura),
        erro.elemento),
      rodapeDaJanela(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Definir liderança da área',
      acao: () => definirLideranca(area.id, titular.value || null, cobertura.value || null),
      depois: async () => {
        fechar();
        mostrarAviso('Liderança atualizada');
        await contexto.recarregar();
      },
    });
    queueMicrotask(() => titular.focus());
    return formulario;
  });
}
