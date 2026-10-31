// Janela "Definir liderança": titular e cobertura de uma área. Só a Presidência chega aqui (o botão depende
// do indicador pode_definir_lideranca) e o banco confere de novo.
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import { tituloDoPapel } from '../../lib/perfil';
import { definirLideranca } from './dados';
import type { ContextoDoOrganograma } from './organograma';
import type { AreaNoOrganograma } from './regras';

export function abrirDefinirLideranca(contexto: ContextoDoOrganograma, no: AreaNoOrganograma): void {
  const { candidatos } = contexto.dados;
  abrirJanela(contexto.pagina, 'lideranca-titulo', `Liderança: ${no.area.titulo}`, (fechar) => {
    const opcoes = (atual: string | null, vazio: string): HTMLOptionElement[] => [
      el('option', { value: '' }, vazio),
      ...candidatos.map((c) => el('option', { value: c.id, selected: c.id === atual }, `${c.nome} · ${tituloDoPapel(c.papel)}`)),
    ];
    const titular = el('select', { id: 'ld-titular' }, ...opcoes(no.area.titular, 'Vaga (sem titular)'));
    const cobertura = el('select', { id: 'ld-cobertura' }, ...opcoes(no.area.cobertura, 'Sem cobertura'));
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
      acao: () => definirLideranca(no.area.id, titular.value || null, cobertura.value || null),
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
