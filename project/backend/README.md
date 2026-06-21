# RecrutaBot — Backend de processamento

Serviço que **lê o CV** (PDF/DOCX), **extrai os dados com IA** e **gera o currículo padronizado .docx** no modelo Hays.

A geração do `.docx` preenche `template.docx` (derivado do modelo Hays original, com tokens do docxtemplater). Por isso a saída é **byte-fiel ao modelo** — só os valores mudam.

## Rodar localmente

```bash
cd backend
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # Windows: set ANTHROPIC_API_KEY=...
npm start                              # sobe em http://localhost:3001
```

## Endpoints

| Método | Rota | Entrada | Saída |
|---|---|---|---|
| POST | `/api/extract` | multipart, campo `file` (pdf/docx) | JSON estruturado do candidato |
| POST | `/api/generate` | JSON do candidato | arquivo `.docx` padronizado |
| GET | `/health` | — | `{ ok: true }` |

O **formato do JSON** (header, perfil, qualificacao, certificacoes, experiencias[], formacao[], referencias, parecer) é o mesmo usado pelo front-end (`lib/model.js`).

## Ligar o front-end a este backend

No front-end, edite `lib/service.js` e defina a URL:

```js
const BACKEND_URL = "http://localhost:3001";
```

Pronto: o app passa a enviar o arquivo para `/api/extract` e os dados para `/api/generate`, em vez de processar no navegador. O contrato é idêntico, então nada mais muda.

## Por que o modelo é fiel

`template.docx` mantém **todas** as partes do arquivo original (estilos, tema, fontes, numeração) intactas; apenas o `word/document.xml` recebeu tokens (`{nome}`, `{p_segmentoArea}`, loop `{#experiencias}…{/experiencias}`, etc.). Para atualizar o modelo, regenere `template.docx` a partir do novo `.docx` padrão repetindo o mesmo processo de tokenização.

## Notas de produção

- Troque o modelo em `server.js` (`ai()`) conforme custo/qualidade. Com modelo grande e `max_tokens` alto, um único pedido cobre o CV inteiro.
- Adicione autenticação, rate-limit e armazenamento (histórico de candidatos) conforme necessário.
- `multer` limita upload a 20 MB.
