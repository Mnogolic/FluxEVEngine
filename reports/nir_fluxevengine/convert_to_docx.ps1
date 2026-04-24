$pandocPath = "C:\Users\kasja\AppData\Local\Pandoc\pandoc.exe"
if (-not (Test-Path $pandocPath)) {
  $pandocPath = "pandoc"
}

& $pandocPath .\nir_fluxevengine_word_ready.md `
  --from markdown+implicit_figures+pipe_tables+table_captions `
  --standalone `
  --resource-path=. `
  --output .\nir_fluxevengine_word_ready.docx

# Если захотите применять собственные стили Word:
# & $pandocPath .\nir_fluxevengine_word_ready.md `
#   --from markdown+implicit_figures+pipe_tables+table_captions `
#   --standalone `
#   --resource-path=. `
#   --reference-doc .\reference.docx `
#   --output .\nir_fluxevengine_word_ready.docx
