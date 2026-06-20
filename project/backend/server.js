// RecrutaBot — backend de processamento (Node 18+ / Express)
// Endpoints:
//   POST /api/extract   (multipart "file": pdf|docx)  -> JSON estruturado do candidato
//   POST /api/generate  (JSON do candidato)           -> .docx padronizado (modelo Hays)
//
// O .docx é gerado preenchendo template.docx (gerado a partir do modelo Hays original
// com tokens docxtemplater) — saída byte-fiel ao modelo, só os valores mudam.
//
// Variáveis de ambiente:
//   ANTHROPIC_API_KEY=...   (obrigatória para /api/extract)
//   PORT=3001               (opcional)

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

const PERFIL_KEYS = [
  "segmentoArea", "especialidade", "especialidadeTempo", "expertiseModulo", "expertiseTempo",
  "proficiencia", "nivelIngles", "nivelEspanhol", "baseAtual", "disponibilidade",
  "valorRecurso", "valorConsultoria", "exAccenture", "projetosAccenture", "disponibilidadeAgendas",
];

// ---------- text extraction ----------
async function fileToText(buf, name) {
  const lower = (name || "").toLowerCase();
  if (lower.endsWith(".pdf")) return (await pdf(buf)).text;
  if (lower.endsWith(".docx")) return (await mammoth.extractRawText({ buffer: buf })).value;
  // tenta docx, senão pdf
  try { return (await mammoth.extractRawText({ buffer: buf })).value; }
  catch { return (await pdf(buf)).text; }
}

// ---------- AI mapping ----------
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseJSON(txt) {
  let s = String(txt || "").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const a = s.indexOf("{"); const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

async function ai(prompt, maxTokens = 4096) {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content.map((c) => c.text || "").join("");
}

async function extractData(rawText) {
  const text = String(rawText || "").slice(0, 60000);
  // Com um modelo maior e teto de tokens alto, uma única chamada cobre o CV inteiro.
  const prompt =
`Você é um assistente de recrutamento tech. Abaixo está o texto bruto de um currículo.
Extraia TODAS as informações e responda APENAS com JSON válido neste formato:
{
 "header": {"name":"","location":"","nationality":"","phone":"","email":""},
 "perfil": {${PERFIL_KEYS.map((k) => `"${k}":""`).join(",")}},
 "qualificacao":"",
 "certificacoes":[],
 "experiencias":[{"empresa":"","cargo":"","periodo":"","local":"","atividades":""}],
 "formacao":[],
 "referencias":"N/A",
 "parecer":""
}
Regras:
- Inclua TODAS as experiências profissionais, na ordem do documento. "atividades" resumido em até 60 palavras, mantendo termos técnicos.
- Em "perfil", infira segmento/área, especialidade, tempo total ("+N anos"), módulo/expertise, senioridade ("Alta (Senior)") e níveis de idioma. Deixe "" o que não houver.
- Campos do recrutador (valorRecurso, valorConsultoria, exAccenture, projetosAccenture, disponibilidadeAgendas) devem ficar "" — serão preenchidos manualmente.
- "qualificacao": parágrafo de resumo profissional. "certificacoes": cursos/certificações técnicas. "formacao": formação acadêmica + certificações formais.
- "parecer": deixe "" (preenchido pelo recrutador). Não invente dados pessoais.
Texto do currículo:
"""${text}"""`;
  const data = parseJSON(await ai(prompt));
  // normaliza
  data.header = data.header || {};
  data.perfil = data.perfil || {};
  PERFIL_KEYS.forEach((k) => { if (data.perfil[k] == null) data.perfil[k] = ""; });
  data.certificacoes = data.certificacoes || [];
  data.experiencias = (data.experiencias || []).map((e) => ({
    empresa: e.empresa || "", cargo: e.cargo || "", periodo: e.periodo || "", local: e.local || "", atividades: e.atividades || "",
  }));
  data.formacao = data.formacao || [];
  data.referencias = data.referencias || "N/A";
  data.parecer = data.parecer || "";
  data.qualificacao = data.qualificacao || "";
  return data;
}

// ---------- docx generation ----------
function flatten(data) {
  const h = data.header || {}, perfil = data.perfil || {};
  const out = {
    nome: h.name || "", consultoria: h.consultancy || "Hays Consultoria",
    localizacao: h.location || "", nacionalidade: h.nationality || "",
    telefone: h.phone || "", email: h.email || "",
    qualificacao: data.qualificacao || "",
    certificacoes: (data.certificacoes || []).filter(Boolean),
    experiencias: (data.experiencias || []).map((e) => ({
      empresa: e.empresa || "", cargo: e.cargo || "", periodo: e.periodo || "", local: e.local || "", atividades: e.atividades || "",
    })),
    formacao: (data.formacao || []).filter(Boolean),
    referencias: data.referencias || "N/A", parecer: data.parecer || "",
  };
  PERFIL_KEYS.forEach((k) => { out["p_" + k] = (perfil[k] || ""); });
  return out;
}

function buildDocx(data) {
  const content = fs.readFileSync(path.join(__dirname, "template.docx"), "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(flatten(data));
  return doc.getZip().generate({ type: "nodebuffer" });
}

// ---------- routes ----------
app.post("/api/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "arquivo ausente" });
    const text = await fileToText(req.file.buffer, req.file.originalname);
    const data = await extractData(text);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/generate", (req, res) => {
  try {
    const buf = buildDocx(req.body || {});
    const name = (req.body?.header?.name || "candidato").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.set("Content-Disposition", `attachment; filename="CV_Padrao_${name}.docx"`);
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`RecrutaBot backend on :${PORT}`));
