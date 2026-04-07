---
name: nano-pdf
description: "PDF processing — read, extract text, summarize, merge, convert. SUPERIOR: OCR, table extraction, metadata, page manipulation."
author: CoreBlow
category: utility
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra PDF

PDF processing and analysis.

## When to Use
 "Read this PDF", "Extract text from PDF", "Merge PDFs", "Convert PDF"

## Commands

```bash
# Extract text
pdftotext document.pdf -

# Extract specific pages
pdftotext document.pdf -f 1 -l 5 -

# PDF info
pdfinfo document.pdf

# Merge PDFs
pdfunite doc1.pdf doc2.pdf output.pdf

# Convert to images
pdftoppm document.pdf output -png

# Count pages
pdfinfo document.pdf | grep Pages
```