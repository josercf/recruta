# RecrutaBot — padronizador de currículos (v0)

App de uso interno do recrutador **Hudson** para padronizar currículos de candidatos
no modelo **Hays**. Fluxo: upload de um CV (PDF com texto ou DOCX) → extração por IA →
revisão/edição manual → geração de um `.docx` padronizado para download.

Uso single‑user (apenas o Hudson). Visual portado fielmente do design em
`project/RecrutaBot.html` (Claude Design) — esse arquivo é a fonte de verdade do front.

---

## Arquitetura

```
┌────────────┐    POST /api/parse (multipart, Bearer JWT)     ┌──────────────────┐
│  Frontend  │ ─────────────────────────────────────────────▶ │   Backend .NET 8 │
│ React+Vite │                                                 │  (minimal API +  │
│  (GH Pages)│ ◀───── Supabase Realtime (status do job) ─────  │ BackgroundService)│
└─────┬──────┘                                                 └────────┬─────────┘
      │  Supabase Auth (e‑mail/senha) + Realtime (anon key, RLS)        │
      ▼                                                                  ▼
┌─────────────────────────────────────────────┐     Anthropic Messages API (IA)
│            Supabase (Postgres)               │     DocxTemplater (.docx Hays)
│  jobs (RLS) · Realtime · Storage privado     │
└─────────────────────────────────────────────┘
```

- **Frontend** — React + Vite, deploy no GitHub Pages. Fala com o backend e assina o
  status do job via Supabase Realtime.
- **Backend** — microserviço .NET 8 (minimal API) com processamento assíncrono via
  `BackgroundService`. Os jobs ficam persistidos na tabela `jobs` (sobrevivem a
  reinício). Extrai texto (PdfPig/OpenXml), estrutura com a Anthropic API e gera o
  `.docx` com DocxTemplater. Segredos só no backend.
- **Supabase** — Auth (e‑mail/senha), Postgres (`jobs` com RLS), Realtime e Storage
  privado (URLs assinadas).
- **IA** — Anthropic Messages API (modelo Sonnet parametrizável).

> **Fora do escopo da v0:** OCR de PDFs digitalizados (retorna erro amigável),
> multiusuário, e retenção de currículos além do processamento (o upload é descartado
> após o parse — ver LGPD abaixo).

## Estrutura do repositório

| Pasta         | Conteúdo |
|---------------|----------|
| `frontend/`   | App React + Vite (deploy GitHub Pages) |
| `backend/`    | Microserviço .NET 8 + `Dockerfile` |
| `supabase/`   | Migrations SQL (jobs, RLS, Realtime, Storage) |
| `templates/`  | Modelo Hays original + versão marcada com placeholders + script de marcação |
| `.github/`    | Workflow de deploy do frontend |
| `project/`    | **Design original** (protótipo HTML/CSS/JS de Claude Design) — referência visual |

---

## Fluxo funcional

1. Hudson faz login (Supabase Auth, e‑mail/senha).
2. Upload do CV → `POST /api/parse` (multipart) com `Authorization: Bearer <jwt>`.
3. Backend valida o JWT, sobe o arquivo ao Storage, cria um job `queued` e retorna
   `202 { jobId }`. O `BackgroundService` extrai o texto, chama a Anthropic API,
   salva o JSON no job, marca `parsed` e **descarta o upload**.
4. Frontend assina o job via Realtime; em `parsed`, carrega o JSON na tela de revisão.
5. Hudson revisa e completa os campos do processo → `POST /api/generate`. Outro job
   gera o `.docx` (DocxTemplater), salva no Storage e marca `done` com a URL assinada.
6. Frontend recebe a atualização e oferece o download.

Status do job: `queued → processing → parsed` (parse) e `queued → processing → done`
(generate); `error` em qualquer falha (ex.: PDF digitalizado).

---

## Setup

### Pré‑requisitos
- Node 20+ (frontend), .NET SDK 8 ou Docker (backend), conta Supabase, chave da
  Anthropic API.

### 1) Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Aplique as migrations: cole `supabase/migrations/0001_init.sql` no **SQL Editor**
   (ou use a CLI: `supabase link` + `supabase db push`). Isso cria a tabela `jobs`
   com RLS, habilita Realtime e cria o bucket privado `cvs`.
3. **Auth → Providers → Email**: habilitado (padrão). Crie o usuário do Hudson em
   **Auth → Users → Add user** (e‑mail + senha). Desative "Confirm email" se quiser
   login imediato, ou confirme o e‑mail.
4. Anote em **Settings → API**: `Project URL`, `anon public` key e
   `service_role` key.

### 2) Backend (.NET 8)
Variáveis de ambiente (segredos **somente** no backend):

| Variável | Obrigatória | Descrição |
|----------|:----------:|-----------|
| `SUPABASE_URL` | ✅ | URL do projeto (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role key (bypassa RLS) |
| `ANTHROPIC_API_KEY` | ✅ | chave da Anthropic API |
| `ALLOWED_ORIGIN` | ✅ (prod) | origem do GitHub Pages (ex.: `https://<owner>.github.io`); aceita lista separada por vírgula |
| `ANTHROPIC_MODEL` | — | padrão `claude-sonnet-4-6` |
| `ANTHROPIC_MAX_TOKENS` | — | padrão `8192` |
| `SUPABASE_BUCKET` | — | padrão `cvs` |
| `SUPABASE_JWT_SECRET` | — | só para projetos legados HS256 (padrão: validação via JWKS) |
| `TEMPLATE_PATH` | — | caminho do template marcado (padrão: `Templates/Hays_Template_marked.docx`) |

Rodar local:
```bash
cd backend
export SUPABASE_URL=...           # e as demais variáveis acima
dotnet run                        # escuta em http://localhost:5xxx
```

Com Docker:
```bash
cd backend
docker build -t recrutabot-api .
docker run -p 8080:8080 \
  -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... -e ANTHROPIC_API_KEY=... \
  -e ALLOWED_ORIGIN=http://localhost:5173 \
  recrutabot-api
```

> Hospedagem alvo: **Azure** (App Service ou Container Apps). Suba a imagem do
> `Dockerfile` e configure as variáveis de ambiente acima como *application settings*.

### 3) Frontend (React + Vite)
Copie `frontend/.env.example` para `frontend/.env`:
```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_API_BASE_URL=http://localhost:8080   # URL do backend
```
A `anon key` é **pública por design** e fica protegida por RLS. **Nunca** coloque a
`service_role` nem a chave da Anthropic no frontend.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## Deploy

### Frontend → GitHub Pages (GitHub Actions)
O workflow `.github/workflows/deploy-frontend.yml` builda e publica em cada push na
`main` que toque `frontend/`.

1. **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** — crie as *variables*:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`.
3. O `base` do Vite é derivado automaticamente do nome do repositório
   (`/<repo>/` → `/recruta/`) via `VITE_BASE`. O app usa **hash routing**
   (+ `404.html` de fallback), então o GitHub Pages não precisa reescrever rotas
   de SPA. URL final: `https://josercf.github.io/recruta/`.
4. Depois do deploy, defina `ALLOWED_ORIGIN` no backend como
   `https://josercf.github.io` (origem do Pages) para liberar o CORS.

### Backend → Azure
Build/push da imagem do `Dockerfile` para o Azure (App Service for Containers ou
Container Apps) e configure as variáveis de ambiente. Aponte `VITE_API_BASE_URL`
(frontend) para a URL pública do backend.

---

## Segurança & LGPD

- Segredos (`service_role`, `ANTHROPIC_API_KEY`) **só** no backend, via variáveis de
  ambiente. O frontend usa apenas a `anon key` (pública, protegida por RLS).
- JWT do Supabase validado no backend via **JWKS**; CORS restrito à origem do Pages.
- **Retenção:** o upload do candidato é **descartado** logo após o parse. O `.docx`
  gerado fica no Storage privado e é baixado via **URL assinada** (expira em 1h).
- OCR não é suportado: PDFs digitalizados retornam erro amigável, sem tentativa de OCR.

---

## Template Hays e schema

`templates/` contém o modelo original (`CV_Hays_Daniel_Oliveira.docx`) e a versão
marcada (`Hays_Template_marked.docx`), gerada por `templates/mark_template.py` a
partir do modelo já estruturado do design — preservando estilos, tema, fontes e as
tabelas pontilhadas (saída fiel ao modelo Hays, só os valores mudam).

A marcação usa a sintaxe do pacote **Amberg/DocxTemplater**: o modelo é vinculado com
prefixo `c` (`template.BindModel("c", model)`), então os placeholders são
`{{c.nome}}`, `{{c.segmento}}`, …; o loop de experiência é
`{{#c.experiencias}} … {{.empresa}} … {{/c.experiencias}}` com `local` condicional
(`{?{.local != ''}}Local: {{.local}}{{/}}`); certificações são uma lista de strings
(`{{#c.certificacoes}}{{.}}{{/c.certificacoes}}`). Os **nomes** dos campos seguem a
especificação; a única diferença frente à lista mustache da spec é o prefixo `c.` e a
forma condicional `{?{}}`, exigidos pelo Amberg/DocxTemplater.

**Schema JSON** (saída da IA = formulário de revisão = entrada de `/api/generate` =
modelo do DocxTemplater): campos preenchidos pela IA — `nome`, contato (`cidade`,
`nacionalidade`, `telefone`, `email`), perfil técnico (`segmento`, `especialidade`,
`tempoExperiencia`, `moduloExpertise`, `tempoModulo`, `proficiencia`, `nivelIngles`,
`nivelEspanhol`, `baseAtual`, `disponibilidade`), `qualificacao`, `certificacoes`
(lista), `experiencias` (lista de `{empresa, cargo, periodo, local, atividades}`) e
`formacao`. Campos do processo (recrutador) ficam vazios para o Hudson completar:
`valorRecursoCLT`, `valorConsultoriaCLT`, `exAccenture`, `atuouAccenture`,
`disponibilidadeAgendas`, `referencias`, `parecer`. **A IA não inventa esses campos.**

Para regenerar o template marcado:
```bash
cd templates
python3 mark_template.py ../project/assets/Hays_Template.docx Hays_Template_marked.docx
cp Hays_Template_marked.docx ../backend/Templates/
```

---

## Notas de implementação / verificação

- **Frontend** e **template** foram verificados neste ambiente: o `vite build`
  compila com o `base` aplicado, e o template marcado renderiza com dados de exemplo
  sem tokens residuais (loop e condicional de `local` corretos).
- **Backend .NET não foi compilado aqui** (sem .NET SDK no ambiente de geração). O
  código é completo e segue o contrato acima; rode `dotnet build`/`dotnet run` (ou o
  `Dockerfile`) para validar no seu ambiente. Versões de NuGet: `DocxTemplater 2.7.3`,
  `PdfPig 0.1.14`, `DocumentFormat.OpenXml 3.1.0`, `Microsoft.AspNetCore.Authentication.JwtBearer 8.*`.
