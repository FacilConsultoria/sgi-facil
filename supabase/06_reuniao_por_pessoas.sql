-- =====================================================================
-- SGI Fácil Consultoria · 06 · Novo tipo de público de reunião: "pessoas"
-- Rodar DEPOIS do 05 e SOZINHO: o Postgres só permite usar um valor novo de
-- enum depois que o comando que o criou termina. O 07 usa esse valor.
-- =====================================================================

alter type public.escopo_reuniao add value if not exists 'pessoas';
