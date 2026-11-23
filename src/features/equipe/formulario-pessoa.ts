// Janela de cadastro e de alteração de pessoa. As opções de cargo e de área vêm do banco (só o que quem cadastra
// pode usar); o banco confere de novo cada envio.
import { tituloDoPapel } from '../../lib/perfil';
import type { Papel, PessoaDaEquipe } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import { atualizarPessoa, cadastrarPessoa, type DadosDaEstrutura } from './dados';
import { nucleosDaArea, ordenarAreasParaCadastro, precisaDeNucleo, validarCadastro } from './regras';

export interface ContextoDoFormulario {
  /** Onde as janelas são montadas (fora do conteúdo, que é redesenhado). */
  pagina: HTMLElement;
  dados: DadosDaEstrutura;
  recarregar: () => Promise<void>;
}

/** Sem `pessoa`, cadastra uma pessoa nova; com ela, altera o cadastro (o e-mail não muda). */
export function abrirFormularioDePessoa(contexto: ContextoDoFormulario, pessoa?: PessoaDaEquipe): void {
  const { dados } = contexto;
  const novo = pessoa === undefined;
  const idDaPresidencia = dados.areas.find((a) => a.area_da_presidencia)?.id ?? null;

  // quem edita pode estar com um cargo ou área que a lista de quem cadastra não traz; mantém a opção atual
  const papeis: Papel[] = pessoa && !dados.papeis.includes(pessoa.papel) ? [pessoa.papel, ...dados.papeis] : dados.papeis;
  const areasDisponiveis = ordenarAreasParaCadastro(dados.areasParaCadastro, idDaPresidencia);
  const areas = pessoa && !areasDisponiveis.some((a) => a.id === pessoa.area_id)
    ? [...areasDisponiveis, ...dados.areas.filter((a) => a.id === pessoa.area_id)]
    : areasDisponiveis;

  abrirJanela(contexto.pagina, 'pessoa-titulo', novo ? 'Cadastrar pessoa' : `Alterar cadastro: ${pessoa.nome}`, (fechar) => {
    const email = el('input', { type: 'email', id: 'pe-email', autocomplete: 'off', placeholder: 'nome@exemplo.com' });
    // depois do cadastro, só a própria pessoa altera o nome (lápis ao lado do nome); o banco ignora mudanças de terceiros
    const nome = el('input', { type: 'text', id: 'pe-nome', maxlength: '120', value: pessoa?.nome ?? '', readonly: !novo, title: novo ? '' : 'Só a própria pessoa altera o nome' });
    // cadastro novo começa em "Membro" (o caso comum) e com a área por escolher
    const papelInicial = pessoa?.papel ?? (papeis.includes('membro') ? 'membro' : papeis[0]);
    const papel = el('select', { id: 'pe-papel' },
      ...papeis.map((p) => el('option', { value: p, selected: p === papelInicial }, tituloDoPapel(p))));
    const area = el('select', { id: 'pe-area' },
      ...(novo ? [el('option', { value: '' }, 'Escolha a área…')] : []),
      ...areas.map((a) => el('option', { value: a.id, selected: a.id === pessoa?.area_id }, a.titulo)));
    const nucleo = el('select', { id: 'pe-nucleo' });
    const blocoDoNucleo = campo('Núcleo', nucleo);
    const curso = el('input', { type: 'text', id: 'pe-curso', maxlength: '120', value: pessoa?.curso ?? '' });
    const ativo = el('input', { type: 'checkbox', id: 'pe-ativo', checked: pessoa?.ativo ?? true });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, novo ? 'Cadastrar' : 'Salvar');
    const erro = linhaDeErro();

    const lerPapel = (): Papel => papel.value as Papel;
    // o núcleo depende da área e some para cargos que não têm núcleo
    const atualizarNucleo = (): void => {
      const atual = nucleo.value || pessoa?.nucleo_id || '';
      substituir(nucleo,
        el('option', { value: '' }, 'Escolha o núcleo…'),
        ...nucleosDaArea(dados.nucleos, area.value).map((n) => el('option', { value: n.id, selected: n.id === atual }, n.nome)));
      blocoDoNucleo.hidden = !precisaDeNucleo(lerPapel());
    };
    papel.addEventListener('change', atualizarNucleo);
    area.addEventListener('change', () => { nucleo.value = ''; atualizarNucleo(); });
    atualizarNucleo();

    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        novo
          ? campo('E-mail', email)
          : el('div', {}, el('label', {}, 'E-mail'), el('p', { class: 'meta' }, pessoa?.email ?? 'Só quem cadastra vê o e-mail.')),
        campo('Nome', nome), campo('Cargo', papel), campo('Área', area), blocoDoNucleo, campo('Curso (opcional)', curso),
        novo ? null : el('label', { class: 'check', for: ativo.id }, ativo, ' Pessoa ativa no SGI'),
        el('p', { class: 'dica' }, novo
          ? 'A pessoa entra no SGI com este e-mail, em "Primeiro acesso", e cria a própria senha.'
          : 'Desativar tira o acesso da pessoa ao SGI; o histórico dela continua.'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));

    const ler = () => ({
      campos: {
        email: email.value, nome: nome.value, papel: lerPapel(), area: area.value, nucleo: precisaDeNucleo(lerPapel()) ? nucleo.value : '',
      },
      curso: curso.value,
    });
    ligarEnvio({
      formulario, botao, erro,
      operacao: novo ? 'Cadastrar pessoa' : 'Alterar cadastro de pessoa',
      validar: () => validarCadastro(ler().campos, dados.nucleos, novo),
      acao: () => {
        const { campos, curso: textoDoCurso } = ler();
        const enviado = { nome: campos.nome, papel: campos.papel, area: campos.area, nucleo: campos.nucleo, curso: textoDoCurso };
        return pessoa ? atualizarPessoa(pessoa.id, enviado, ativo.checked) : cadastrarPessoa(campos.email, enviado);
      },
      depois: async () => {
        fechar();
        mostrarAviso(novo ? 'Pessoa cadastrada' : 'Cadastro atualizado');
        await contexto.recarregar();
      },
    });
    queueMicrotask(() => (novo ? email : papel).focus());
    return formulario;
  });
}
