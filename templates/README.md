# RecrutaBot — templates Hays

| Arquivo | O que é |
|---------|---------|
| `CV_Hays_Daniel_Oliveira.docx` | Modelo Hays original (exemplo preenchido, referência visual) |
| `Hays_Template_marked.docx` | Modelo marcado com placeholders do DocxTemplater (consumido pelo backend) |
| `mark_template.py` | Gera o template marcado a partir do modelo estruturado do design |

O template marcado usa a sintaxe do pacote **Amberg/DocxTemplater** (modelo vinculado
com prefixo `c`): placeholders `{{c.nome}}`, `{{c.segmento}}`, …; loop de experiência
`{{#c.experiencias}} … {{.empresa}} … {{/c.experiencias}}` com `local` condicional
(`{?{.local != ''}}Local: {{.local}}{{/}}`); certificações como lista de strings
(`{{#c.certificacoes}}{{.}}{{/c.certificacoes}}`); `formacao` como campo único.
Estilos, tema, fontes e tabelas pontilhadas são preservados do modelo original —
saída fiel ao Hays, só os valores mudam.

## Regenerar
```bash
python3 mark_template.py ../project/assets/Hays_Template.docx Hays_Template_marked.docx
cp Hays_Template_marked.docx ../backend/Templates/
```
A cópia em `backend/Templates/` é embarcada na imagem do container (via `.csproj`).
