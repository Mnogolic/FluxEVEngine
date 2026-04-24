from __future__ import annotations

import re
from pathlib import Path


REPORT_DIR = Path("reports/nir_fluxevengine")
SOURCE_PATH = REPORT_DIR / "nir_fluxevengine_report.md"
TARGET_PATH = REPORT_DIR / "nir_fluxevengine_word_ready.md"
CONVERT_SCRIPT_PATH = REPORT_DIR / "convert_to_docx.ps1"


def extract_body(text: str) -> str:
    marker = "## Аннотация"
    start = text.find(marker)
    return text[start:] if start >= 0 else text


def normalize_headings(text: str) -> str:
    replacements = {
        "## Аннотация": "# Аннотация {-}",
        "## Abstract": "# Abstract {-}",
        "## Ключевые слова": "# Ключевые слова {-}",
        "## Keywords": "# Keywords {-}",
        "## Список литературы": "# Список литературы {-}",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    text = re.sub(r"^##\s+\d+\.\s+(.+)$", r"# \1", text, flags=re.MULTILINE)
    return text


def add_page_breaks(text: str) -> str:
    sections = [
        "# Abstract {-}",
        "# Ключевые слова {-}",
        "# Keywords {-}",
        "# Введение",
        "# Обзор аналогов и существующих решений",
        "# Описание разработки",
        "# Реализация",
        "# Результаты тестирования и апробации",
        "# Заключение",
        "# Список литературы {-}",
    ]
    for heading in sections:
        text = text.replace(heading, f"\\newpage\n\n{heading}")
    return text


def normalize_images(text: str) -> str:
    return re.sub(
        r"!\[([^\]]+)\]\(([^)]+)\)",
        r"![\1](\2){ width=92% }",
        text,
    )


def build_front_matter() -> str:
    return """---
title: "Научно-исследовательская работа"
subtitle: "Разработка и реализация программного интерфейса для анализа внутриигровой экономики"
author: "[ФИО]"
date: "Москва, 2025"
lang: ru-RU
toc: true
toc-depth: 3
numbersections: true
toc-title: "Содержание"
---

"""


def build_title_page() -> str:
    return """**РОССИЙСКИЙ УНИВЕРСИТЕТ ДРУЖБЫ НАРОДОВ ИМЕНИ ПАТРИСА ЛУМУМБЫ**  
**Факультет физико-математических и естественных наук**  
**Кафедра математического моделирования и искусственного интеллекта**

  
**УТВЕРЖДАЮ**  
Заведующий кафедрой математического моделирования и искусственного интеллекта  
`__________________` `[ФИО]`  
`«____» ____________ 2025 г.`

  
**НАУЧНО-ИССЛЕДОВАТЕЛЬСКАЯ РАБОТА**

  
**на тему**  
**«Разработка и реализация программного интерфейса для анализа внутриигровой экономики»**

  
Выполнил: `[ФИО]`  
Студент группы: `[Группа]`  
Студенческий билет №: `[Номер]`

  
Руководитель: `[ФИО научного руководителя]`

  
**Москва 2025**

\\newpage

"""


def build_convert_script() -> str:
    return """$pandocPath = "C:\\Users\\kasja\\AppData\\Local\\Pandoc\\pandoc.exe"
if (-not (Test-Path $pandocPath)) {
  $pandocPath = "pandoc"
}

& $pandocPath .\\nir_fluxevengine_word_ready.md `
  --from markdown+implicit_figures+pipe_tables+table_captions `
  --standalone `
  --resource-path=. `
  --output .\\nir_fluxevengine_word_ready.docx

# Если захотите применять собственные стили Word:
# & $pandocPath .\\nir_fluxevengine_word_ready.md `
#   --from markdown+implicit_figures+pipe_tables+table_captions `
#   --standalone `
#   --resource-path=. `
#   --reference-doc .\\reference.docx `
#   --output .\\nir_fluxevengine_word_ready.docx
"""


def main() -> None:
    source_text = SOURCE_PATH.read_text(encoding="utf-8")
    body = extract_body(source_text)
    body = normalize_headings(body)
    body = add_page_breaks(body)
    body = normalize_images(body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip() + "\n"

    target_text = build_front_matter() + build_title_page() + body
    TARGET_PATH.write_text(target_text, encoding="utf-8")
    CONVERT_SCRIPT_PATH.write_text(build_convert_script(), encoding="utf-8")
    print(f"Word-ready markdown written to: {TARGET_PATH}")
    print(f"Pandoc helper script written to: {CONVERT_SCRIPT_PATH}")


if __name__ == "__main__":
    main()
