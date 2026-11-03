// Seletor "Ver como" na faixa do ambiente de desenvolvimento: a conta de teste troca de cargo para ver a plataforma
// pela ótica de cada um. Só existe quando VITE_AMBIENTE=desenvolvimento; o banco de dev decide quem pode trocar
// (public.dev_trocar_meu_cargo, criado só pelo supabase/dev/03_trocar_cargo_dev.sql).
import { ehDesenvolvimento } from '../../lib/ambiente';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { supabase } from '../../lib/supabase';
import type { Perfil } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { cargoAtual, opcoesDeCargo, type AreaSimples, type CargoEscolhido, type NucleoSimples } from './regras';

async function carregarEstrutura(): Promise<{ areas: AreaSimples[]; nucleos: NucleoSimples[] }> {
  const [areas, nucleos] = await Promise.all([
    supabase.from('areas').select('id, titulo'),
    supabase.from('nucleos').select('id, nome, area_id'),
  ]);
  if (areas.error) throw areas.error;
  if (nucleos.error) throw nucleos.error;
  return { areas: (areas.data ?? []) as AreaSimples[], nucleos: (nucleos.data ?? []) as NucleoSimples[] };
}

async function trocarCargo(cargo: CargoEscolhido): Promise<void> {
  const { error } = await supabase.rpc('dev_trocar_meu_cargo', { p_papel: cargo.papel, p_area: cargo.area, p_nucleo: cargo.nucleo });
  if (error) throw error;
}

/** Põe o seletor na faixa do topo; ao trocar, recarrega a página para o sistema todo refletir o novo cargo. */
export async function montarTrocaDeCargo(perfil: Perfil): Promise<void> {
  const faixa = document.querySelector('.faixa-ambiente');
  if (!ehDesenvolvimento || !faixa) return;
  faixa.querySelector('.troca-de-cargo')?.remove();

  let estrutura;
  try {
    estrutura = await carregarEstrutura();
  } catch (erro: unknown) {
    registrarErro('Carregar cargos do ambiente de desenvolvimento', erro);
    return;
  }
  const opcoes = opcoesDeCargo(estrutura.areas, estrutura.nucleos);
  const atual = cargoAtual(perfil);
  const grupos = [...new Set(opcoes.map((o) => o.grupo))];
  const seletor = el('select', { id: 'dev-cargo' },
    ...(opcoes.some((o) => o.valor === atual) ? [] : [el('option', { value: atual, selected: true }, 'Cargo atual')]),
    ...grupos.map((grupo) => el('optgroup', { label: grupo },
      ...opcoes.filter((o) => o.grupo === grupo).map((o) => el('option', { value: o.valor, selected: o.valor === atual }, o.rotulo)))));

  seletor.addEventListener('change', () => {
    const escolhida = opcoes.find((o) => o.valor === seletor.value);
    if (!escolhida) return;
    seletor.disabled = true;
    trocarCargo(escolhida)
      .then(() => window.location.reload())
      .catch((erro: unknown) => {
        registrarErro('Trocar cargo no ambiente de desenvolvimento', erro);
        mostrarAviso(mensagemParaUsuario(erro), 'erro');
        seletor.value = atual;
        seletor.disabled = false;
      });
  });

  faixa.append(el('span', { class: 'troca-de-cargo' }, el('label', { for: 'dev-cargo' }, 'Ver como'), seletor));
}
