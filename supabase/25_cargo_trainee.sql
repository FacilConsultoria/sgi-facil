-- =====================================================================
-- SGI Fácil Consultoria · 25 · Cargo "trainee"
-- Rodar SOZINHO, depois do 24, e esperar terminar antes do 26
-- (o Postgres só deixa usar um valor novo de enum depois que este script termina).
-- As regras do cargo ficam no 26.
-- =====================================================================

alter type public.papel add value if not exists 'trainee';
