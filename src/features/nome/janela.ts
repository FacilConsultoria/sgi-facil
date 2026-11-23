// Janela "Seu nome": a própria pessoa ajusta o nome completo (oficial, usado nas iniciais) e o apelido,
// que aparece no lugar do nome em rankings, listas e painéis. Só ela altera; o banco confere (definir_meu_nome).
import { supabase } from '../../lib/supabase';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';

interface MeuNome {
  nome_completo: string;
  apelido: string | null;
}

async function carregarMeuNome(pessoaId: string): Promise<MeuNome> {
  const { data, error } = await supabase.from('pessoas').select('nome_completo, apelido').eq('id', pessoaId).maybeSingle();
  if (error) throw error;
  return (data ?? { nome_completo: '', apelido: null }) as MeuNome;
}

async function salvarMeuNome(nomeCompleto: string, apelido: string): Promise<void> {
  const { error } = await supabase.rpc('definir_meu_nome', { p_nome_completo: nomeCompleto, p_apelido: apelido || null });
  if (error) throw error;
}

/** Abre a janela; `aoSalvar` recebe o nome que passa a aparecer (apelido ou nome completo). */
export async function abrirMeuNome(pai: HTMLElement, pessoaId: string, aoSalvar: (nomeMostrado: string) => void): Promise<void> {
  let atual: MeuNome;
  try {
    atual = await carregarMeuNome(pessoaId);
  } catch {
    mostrarAviso('Não foi possível carregar seu nome. Tente de novo.', 'erro');
    return;
  }
  abrirJanela(pai, 'meu-nome-titulo', 'Seu nome', (fechar) => {
    const nome = el('input', { type: 'text', id: 'mn-nome', maxlength: '120', value: atual.nome_completo, autocomplete: 'name' });
    const apelido = el('input', { type: 'text', id: 'mn-apelido', maxlength: '40', value: atual.apelido ?? '', placeholder: 'Opcional' });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Nome completo', nome),
        campo('Apelido', apelido),
        el('p', { class: 'dica' }, 'O apelido aparece no lugar do nome em rankings, listas e painéis. As iniciais continuam as do nome completo. Só você altera seu nome.'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Salvar meu nome',
      validar: () => {
        const completo = nome.value.trim().replace(/\s+/g, ' ');
        if (completo.length < 5 || !completo.includes(' ')) return 'Informe o nome completo, com nome e sobrenome.';
        const curto = apelido.value.trim();
        return curto && (curto.length < 2 || curto.length > 40) ? 'O apelido tem de 2 a 40 caracteres.' : null;
      },
      acao: () => salvarMeuNome(nome.value.trim(), apelido.value.trim()),
      depois: () => {
        fechar();
        mostrarAviso('Nome salvo');
        aoSalvar(apelido.value.trim().replace(/\s+/g, ' ') || nome.value.trim().replace(/\s+/g, ' '));
      },
    });
    queueMicrotask(() => nome.focus());
    return formulario;
  });
}
