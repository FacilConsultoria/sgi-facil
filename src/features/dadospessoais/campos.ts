// Campos do formulário de dados pessoais, usados na criação de senha (primeiro acesso) e na janela "Meus dados".
// CPF e data aparecem com máscara enquanto a pessoa digita só números.
import { el } from '../../ui/dom';
import { campo } from '../../ui/formulario';
import { GENEROS, mascararCpf, mascararData, type CamposDigitados } from './regras';

export interface CamposDeDadosPessoais {
  elementos: HTMLElement[];
  ler: () => CamposDigitados;
  focar: () => void;
}

export function montarCamposDeDadosPessoais(inicial?: CamposDigitados): CamposDeDadosPessoais {
  const nome = el('input', {
    type: 'text', id: 'dp-nome-completo', name: 'nome-completo', autocomplete: 'name', maxlength: '120', required: true, value: inicial?.nomeCompleto ?? '',
  });
  const rga = el('input', {
    type: 'text', id: 'dp-rga', name: 'rga', autocomplete: 'off', maxlength: '16', required: true, placeholder: '12 caracteres', value: inicial?.rga ?? '',
  });
  const cpf = el('input', {
    type: 'text', id: 'dp-cpf', name: 'cpf', inputmode: 'numeric', autocomplete: 'off', maxlength: '14', required: true, placeholder: '000.000.000-00', value: inicial?.cpf ?? '',
  });
  const nascimento = el('input', {
    type: 'text', id: 'dp-nascimento', name: 'nascimento', inputmode: 'numeric', autocomplete: 'off', maxlength: '10', required: true, placeholder: 'dd/mm/aaaa', value: inicial?.nascimento ?? '',
  });
  const genero = el('select', { id: 'dp-genero', name: 'genero', required: true },
    el('option', { value: '' }, 'Selecione'),
    ...GENEROS.map((g) => el('option', { value: g.id, selected: g.id === inicial?.genero }, g.nome)));

  cpf.addEventListener('input', () => { cpf.value = mascararCpf(cpf.value); });
  nascimento.addEventListener('input', () => { nascimento.value = mascararData(nascimento.value); });

  return {
    elementos: [
      el('p', { class: 'dica' },
        'Usamos estes dados nos cadastros que a Fácil faz por você (eventos, acesso a blocos aos sábados e feriados), para não pedir de novo. Só você altera; além de você, só quem ocupa a Presidência vê.'),
      campo('Nome completo', nome),
      el('p', { class: 'dica' }, 'Como no documento. O nome curto que a equipe usa (ex.: Mel, Maju, Duda) continua como está no cadastro.'),
      campo('RGA (Registro Geral Acadêmico)', rga),
      campo('CPF', cpf),
      campo('Data de nascimento', nascimento),
      campo('Gênero', genero),
      el('p', { class: 'dica' },
        'O sistema usa o gênero para escrever o seu cargo corretamente (por exemplo, “a Presidente” ou “o Vice-Presidente”). Só a forma de tratamento (feminino, masculino ou neutro) fica visível a todos; o gênero em si, não.'),
    ],
    ler: () => ({ nomeCompleto: nome.value, rga: rga.value, cpf: cpf.value, nascimento: nascimento.value, genero: genero.value }),
    focar: () => nome.focus(),
  };
}
