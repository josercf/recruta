# RecrutaBot — backend (.NET 8)

Microserviço minimal API com processamento assíncrono via `BackgroundService`.

## Endpoints
- `POST /api/parse` — multipart `file` (PDF/DOCX) + `Authorization: Bearer <jwt>` →
  `202 { jobId }`. Sobe o arquivo ao Storage e enfileira um job `parse`.
- `POST /api/generate` — JSON do candidato + Bearer → `202 { jobId }`. Enfileira um
  job `generate`.
- `GET /api/jobs/{id}` — fallback de polling (escopado ao usuário).
- `GET /health` — healthcheck.

## Como funciona
Um `JobProcessor : BackgroundService` consome a tabela `jobs` do Supabase
(persistida → sobrevive a reinício), reivindicando o próximo `queued` de forma
atômica (`queued → processing`). Parse: extrai texto (`UglyToad.PdfPig` p/ PDF,
`DocumentFormat.OpenXml` p/ DOCX), chama a Anthropic API e salva o JSON; descarta o
upload (LGPD). Generate: preenche o template Hays com `DocxTemplater`, sobe ao
Storage e gera URL assinada.

PDFs sem texto extraível (provável digitalizado) → job `error` com a mensagem
"Este PDF parece digitalizado. OCR não é suportado nesta versão." (sem OCR).

## Rodar
```bash
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... ALLOWED_ORIGIN=...
dotnet run
# ou: docker build -t recrutabot-api . && docker run -p 8080:8080 -e ... recrutabot-api
```

Variáveis de ambiente: ver o README na raiz. Segredos **nunca** vão para o frontend.

> Validação do JWT do Supabase via JWKS (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
> defina `SUPABASE_JWT_SECRET` apenas para projetos legados que assinam em HS256.
