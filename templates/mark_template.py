#!/usr/bin/env python3
"""
Gera o template Hays marcado com placeholders do DocxTemplater (pacote
**Amberg/DocxTemplater**, NuGet), a partir do modelo original já estruturado em
project/assets/Hays_Template.docx.

Por que reescrever só os tokens?  O modelo original já tem todas as seções
posicionadas — inclusive o loop de Experiência dentro de uma única célula de
tabela. Reescrevemos APENAS o texto dos tokens em word/document.xml, mantendo
intactos estilos, tema, fontes e tabelas pontilhadas. Saída fiel ao modelo Hays.

Sintaxe do Amberg/DocxTemplater (difere do mustache puro!):
  - delimitadores `{{ }}`;
  - o modelo é vinculado com um PREFIXO (aqui: "c"), então os campos são
    `{{c.nome}}`, `{{c.segmento}}`, ...;
  - coleções: `{{#c.experiencias}} ... {{/c.experiencias}}`, item atual = `.`
    (ex.: `{{.empresa}}`); lista de strings: `{{#c.certificacoes}}{{.}}{{/c.certificacoes}}`;
  - condicionais: `{?{ <expr> }} ... {{/}}` (ex.: `{?{.local != ''}}Local: {{.local}}{{/}}`).

Os NOMES de campo seguem a especificação (nome, cidade, segmento, ...). A única
diferença frente à lista da spec é o prefixo `c.` e a forma condicional `{?{}}`,
exigidos pelo Amberg/DocxTemplater.

Uso:  python3 mark_template.py <origem.docx> <destino.docx>
"""
import sys, zipfile, os, re

SRC = sys.argv[1] if len(sys.argv) > 1 else "../project/assets/Hays_Template.docx"
DST = sys.argv[2] if len(sys.argv) > 2 else "Hays_Template_marked.docx"
DOC = "word/document.xml"
P = "c."  # prefixo do modelo vinculado no backend (template.BindModel("c", model))

# Tokens escalares simples: token single-brace original -> nome (spec).
SIMPLE = {
    "nome": "nome", "consultoria": "consultoria", "localizacao": "cidade",
    "nacionalidade": "nacionalidade", "telefone": "telefone", "email": "email",
    "p_segmentoArea": "segmento", "p_especialidade": "especialidade",
    "p_especialidadeTempo": "tempoExperiencia", "p_expertiseModulo": "moduloExpertise",
    "p_expertiseTempo": "tempoModulo", "p_proficiencia": "proficiencia",
    "p_nivelIngles": "nivelIngles", "p_nivelEspanhol": "nivelEspanhol",
    "p_baseAtual": "baseAtual", "p_disponibilidade": "disponibilidade",
    "p_valorRecurso": "valorRecursoCLT", "p_valorConsultoria": "valorConsultoriaCLT",
    "p_exAccenture": "exAccenture", "p_projetosAccenture": "atuouAccenture",
    "p_disponibilidadeAgendas": "disponibilidadeAgendas",
    "qualificacao": "qualificacao", "referencias": "referencias", "parecer": "parecer",
}


def transform(xml: str) -> str:
    # 1) Formação: loop {#formacao}{.}{/formacao} -> campo único {{c.formacao}}
    a = xml.find("{#formacao}")
    b0 = xml.find("{/formacao}")
    if a < 0 or b0 < 0 or b0 < a:
        raise ValueError("Template inválido: região {#formacao}...{/formacao} não encontrada.")
    b = b0 + len("{/formacao}")
    region = xml[a:b]
    region = region.replace("{#formacao}", "")
    region = region.replace("{.}", "{{%sformacao}}" % P, 1)
    region = region.replace("{/formacao}", "")
    xml = xml[:a] + region + xml[b:]

    # 2) Experiências: loop + campos do item atual + condicionais por linha.
    xml = xml.replace("{#experiencias}", "{{#%sexperiencias}}" % P)
    xml = xml.replace("{/experiencias}", "{{/%sexperiencias}}" % P)
    xml = xml.replace("{empresa}", "{{.empresa}}")
    for f in ("cargo", "periodo", "local", "atividades"):
        xml = xml.replace("{#%s}" % f, "{?{.%s != ''}}" % f)
        xml = xml.replace("{/%s}" % f, "{{/}}")
        xml = xml.replace("{%s}" % f, "{{.%s}}" % f)

    # 3) Certificações: lista de strings.
    xml = xml.replace("{#certificacoes}", "{{#%scertificacoes}}" % P)
    xml = xml.replace("{/certificacoes}", "{{/%scertificacoes}}" % P)
    # resta apenas o {.} da lista de certificações
    xml = xml.replace("{.}", "{{.}}")

    # 4) Escalares (header + perfil + textos longos) com prefixo do modelo.
    for old, new in SIMPLE.items():
        xml = xml.replace("{%s}" % old, "{{%s%s}}" % (P, new))

    return xml


def main():
    zin = zipfile.ZipFile(SRC, "r")
    xml = zin.read(DOC).decode("utf-8")
    new_xml = transform(xml)

    tmp = DST + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == DOC:
                data = new_xml.encode("utf-8")
            zout.writestr(item, data)
    zin.close()
    os.replace(tmp, DST)

    # relatório
    from xml.dom.minidom import parseString
    parseString(new_xml)  # garante XML bem-formado
    toks = sorted(set(re.findall(r"\{\{[#/]?\.?[A-Za-z_.]*\}\}|\{\?\{[^}]*\}\}", new_xml)))
    leftover = sorted(set(t for t in re.findall(r"\{[#/]?(?:p_)?[a-z_]+\}", new_xml)))
    print("OK ->", DST, "| XML bem-formado ✓")
    print("Tokens (%d):" % len(toks))
    for t in toks:
        print("  ", t)
    print("Single-brace remanescentes:", leftover if leftover else "nenhum ✓")


if __name__ == "__main__":
    main()
