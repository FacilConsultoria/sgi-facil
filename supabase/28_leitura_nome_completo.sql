-- =====================================================================
-- SGI Fácil Consultoria · 28 · Leitura do nome completo e do apelido
-- Rodar depois do 27.
--
-- A leitura de public.pessoas é liberada coluna a coluna (15 e 16). As colunas novas do 27
-- (nome_completo e apelido) ficaram de fora, e o site não conseguia lê-las (janela do lápis
-- e iniciais na tela de Demandas). Nome e apelido são públicos para quem tem cadastro, como o nome.
-- =====================================================================

grant select (nome_completo, apelido) on public.pessoas to authenticated;
