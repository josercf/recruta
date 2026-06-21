# RecrutaBot — Supabase

Schema versionado como migrations SQL.

## Aplicar
- **SQL Editor:** cole o conteúdo de `migrations/0001_init.sql` e rode.
- **CLI:** `supabase link --project-ref <ref>` e `supabase db push`.

`0001_init.sql` cria:
- Tabela `public.jobs` (`id`, `user_id`, `type`, `status`, `input`, `result`,
  `docx_url`, `error`, `created_at`, `updated_at`) com trigger de `updated_at`.
- **RLS** ativo: cada usuário acessa apenas os próprios jobs (o backend usa a
  `service_role`, que bypassa RLS).
- **Realtime** na tabela `jobs` (`replica identity full`).
- Bucket de **Storage** privado `cvs` (uploads transitórios + DOCX gerados; download
  por URL assinada).

## Auth
Habilite **Email** em Auth → Providers (padrão) e crie o usuário do Hudson em
Auth → Users. Sem signup público nesta v0.
