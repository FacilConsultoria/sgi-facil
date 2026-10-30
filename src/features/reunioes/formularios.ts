// Janelas de cadastro do módulo de Reuniões e atas: agendar reunião e ligar uma transcrição a uma reunião.
// Os públicos e as reuniões oferecidos vêm das visões do banco, já limitados ao que a pessoa pode usar.
import { dataCurta, horaCurta, somarDias } from '../../lib/datas';
import { plural } from '../../lib/texto';
import type { PublicoDeReuniao, TranscricaoDaReuniao } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import type { ContextoDeReunioes } from './contexto';
import { criarReuniao, vincularTranscricao } from './dados';
import { abrirPainelDaReuniao } from './painel';
import { agruparPublicosParaAgendar, chaveDoPublico, validarReuniao } from './regras';

export function abrirNovaReuniao(contexto: ContextoDeReunioes): void {
  const { dados, hoje } = contexto;
  const grupos = agruparPublicosParaAgendar(dados.publicos);
  const publicos = grupos.flatMap((grupo) => grupo.publicos);
  const primeiro = publicos[0];
  if (!primeiro) {
    mostrarAviso('Você não tem públicos para os quais possa agendar reunião.', 'erro');
    return;
  }

  abrirJanela(contexto.pagina, 'nova-reuniao-titulo', 'Agendar reunião', (fechar) => {
    const titulo = el('input', { type: 'text', id: 'nr-titulo', maxlength: '100', placeholder: 'Ex.: Alinhamento semanal' });
    const publico = el('select', { id: 'nr-publico' },
      ...grupos.map((grupo) => el('optgroup', { label: grupo.titulo },
        ...grupo.publicos.map((p) => el('option', { value: chaveDoPublico(p.escopo, p.escopo_id) }, p.titulo)))));
    const convocados = el('p', { class: 'dica' });
    const data = el('input', { type: 'date', id: 'nr-data', value: somarDias(hoje, 3) });
    const hora = el('input', { type: 'time', id: 'nr-hora', value: '19:00' });
    const pauta = el('textarea', { id: 'nr-pauta', placeholder: 'Assuntos e decisões esperadas' });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Agendar');
    const erro = linhaDeErro();

    const publicoEscolhido = (): PublicoDeReuniao | undefined => publicos.find((p) => chaveDoPublico(p.escopo, p.escopo_id) === publico.value);
    const mostrarConvocados = (): void => {
      const total = publicoEscolhido()?.total_convocados ?? 0;
      convocados.textContent = `${plural(total, 'pessoa será convocada', 'pessoas serão convocadas')}.`;
    };
    mostrarConvocados();
    publico.addEventListener('change', mostrarConvocados);

    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Título', titulo),
        el('div', {}, el('label', { for: 'nr-publico' }, 'Público'), publico, convocados),
        el('div', { class: 'dois' }, campo('Data', data), campo('Horário', hora)),
        campo('Pauta', pauta),
        erro.elemento),
      rodapeDaJanela(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Agendar reunião',
      validar: () => validarReuniao({ titulo: titulo.value, data: data.value, hora: hora.value, publico: publico.value }),
      acao: () => {
        const escolhido = publicoEscolhido() ?? primeiro;
        return criarReuniao({
          titulo: titulo.value.trim(),
          data: data.value,
          hora: hora.value,
          escopo: escolhido.escopo,
          escopoId: escolhido.escopo_id,
          pauta: pauta.value.trim(),
        });
      },
      depois: async (id) => {
        fechar();
        mostrarAviso('Reunião agendada');
        const atualizado = await contexto.recarregar();
        if (atualizado) abrirPainelDaReuniao(atualizado, id);
      },
    });
    queueMicrotask(() => titulo.focus());
    return formulario;
  });
}

/** Liga uma transcrição recebida sem reunião a uma reunião que a pessoa organiza e que ainda não tem transcrição. */
export function abrirVinculo(contexto: ContextoDeReunioes, transcricao: TranscricaoDaReuniao): void {
  const candidatas = contexto.dados.reunioes
    .filter((r) => r.pode_gerir && !r.tem_transcricao)
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
  if (candidatas.length === 0) {
    mostrarAviso('Não há reunião sua sem transcrição para ligar a esta.', 'erro');
    return;
  }

  abrirJanela(contexto.pagina, 'vincular-transcricao-titulo', 'Ligar transcrição a uma reunião', (fechar) => {
    const reuniao = el('select', { id: 'vt-reuniao' },
      ...candidatas.map((r) => el('option', { value: r.id }, `${dataCurta(r.data)} ${horaCurta(r.hora)} · ${r.titulo}`)));
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Ligar transcrição');
    const erro = linhaDeErro();

    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        el('p', { class: 'dica' }, `Transcrição recebida${transcricao.titulo_origem ? ` como “${transcricao.titulo_origem}”` : ''}. Escolha a reunião a que ela pertence.`),
        campo('Reunião', reuniao),
        erro.elemento),
      rodapeDaJanela(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Ligar transcrição à reunião',
      acao: () => vincularTranscricao(transcricao.id, reuniao.value),
      depois: async () => {
        fechar();
        mostrarAviso('Transcrição ligada à reunião');
        const atualizado = await contexto.recarregar();
        if (atualizado) abrirPainelDaReuniao(atualizado, reuniao.value);
      },
    });
    return formulario;
  });
}
