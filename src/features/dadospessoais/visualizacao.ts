// Dados pessoais de uma pessoa, só leitura, para a Presidente, a Assessoria de Presidência e a diretoria da área (a RLS
// devolve linha só a elas e à própria pessoa; quem chama aqui só mostra o botão quando a pessoa tem pode_ver_dados).
// Nada é editado por esta janela.
import { dataEHora, hojeEmSaoPaulo } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { mostrarAviso } from '../../ui/aviso';
import { abrirCamada } from '../../ui/camada';
import { el } from '../../ui/dom';
import { botaoFechar } from '../../ui/formulario';
import { carregarDadosDe } from './dados';
import { descreverNascimento, formatarCpf, nomeDoGenero } from './regras';

export async function abrirDadosDaPessoa(pai: HTMLElement, pessoa: { id: string; nome: string }): Promise<void> {
  let dados;
  try {
    dados = await carregarDadosDe(pessoa.id);
  } catch (erro: unknown) {
    registrarErro('Carregar dados pessoais de uma pessoa', erro);
    mostrarAviso(mensagemParaUsuario(erro), 'erro');
    return;
  }

  abrirCamada(pai, {
    tipo: 'modal',
    idDoTitulo: 'dados-da-pessoa-titulo',
    montar: (fechar) => {
      const fecharJanela = el('button', { type: 'button', class: 'btn' }, 'Fechar');
      fecharJanela.addEventListener('click', fechar);
      const linha = (rotulo: string, valor: string): HTMLElement[] => [el('dt', {}, rotulo), el('dd', {}, valor)];
      const corpo = dados
        ? el('dl', { class: 'dl dados-pessoais' },
          ...linha('Nome completo', dados.nome_completo),
          ...linha('Nome no sistema', pessoa.nome),
          ...linha('RGA', dados.rga),
          ...linha('CPF', formatarCpf(dados.cpf)),
          ...linha('Nascimento', descreverNascimento(dados.nascimento, hojeEmSaoPaulo())),
          ...linha('Gênero', nomeDoGenero(dados.genero)),
          ...linha('Atualizado em', dataEHora(dados.atualizado_em)))
        : el('p', { class: 'vazio' }, `${pessoa.nome} ainda não preencheu os dados pessoais.`);
      return [
        el('div', { class: 'form-janela' },
          el('div', { class: 'painel-cab' }, el('h2', { id: 'dados-da-pessoa-titulo' }, `Dados pessoais: ${pessoa.nome}`), botaoFechar(fechar)),
          el('div', { class: 'painel-corpo' }, corpo,
            el('p', { class: 'dica' }, 'Leem estes dados a própria pessoa, a Presidente, a Assessoria de Presidência e a diretoria da área. Só a própria pessoa os altera.')),
          el('div', { class: 'modal-pe' }, fecharJanela)),
      ];
    },
  });
}
