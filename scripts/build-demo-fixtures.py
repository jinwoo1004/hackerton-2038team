"""Build deterministic synthetic document/parser fixtures, never production inputs."""
from pathlib import Path
from datetime import datetime
import hashlib
import io
import json
import zipfile
import re

from docx import Document
from docx.shared import Pt
from openpyxl import Workbook
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

ROOT = Path(__file__).resolve().parents[1] / 'demo-fixtures'
STAMP = (2026, 9, 21, 0, 0, 0)
RULES = [
    'Do not use `console.log` in application source. Use a structured logger.',
    'Do not use `eval` to interpret a received message. Parse and validate fields.',
    'A function must contain at most 20 lines.',
    'The line length must not exceed 100 characters.',
    'All function names must follow camelCase.',
]

def archive(path, entries):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in entries:
            info = zipfile.ZipInfo(name, STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data)

def normalize_zip(path):
    with zipfile.ZipFile(path) as z:
        entries = [(name, z.read(name)) for name in z.namelist()]
    entries = [(name, re.sub(rb'(<dcterms:modified[^>]*>)[^<]+', rb'\g<1>2026-09-21T00:00:00Z', data) if name == 'docProps/core.xml' else data) for name, data in entries]
    archive(path, entries)

archive(ROOT/'wallpad-source.zip', [('src/WallpadClient.ts', (ROOT/'source/WallpadClient.ts').read_bytes())])

c = canvas.Canvas(str(ROOT/'rules.pdf'), pagesize=letter, invariant=1)
c.setTitle('Wallpad demonstration coding rules')
c.setAuthor('2038 Team')
c.setFont('Helvetica-Bold', 18)
c.drawString(48, 742, 'Wallpad demonstration coding rules')
c.setFont('Helvetica', 10)
c.drawString(48, 718, 'Synthetic test rules. This is not the protected protocol attachment.')
for i, rule in enumerate(RULES):
    c.drawString(48, 675-i*34, f'{i+1}. {rule}')
c.drawString(48, 450, 'Upload this document together with wallpad-source.zip.')
c.save()

doc = Document()
doc.add_heading('Wallpad demonstration coding rules', 0)
doc.add_paragraph('Synthetic test rules. This is not the protected protocol attachment.')
for rule in RULES:
    doc.add_paragraph(rule, style='List Bullet')
doc.styles['Normal'].font.size = Pt(11)
doc.core_properties.created = datetime(*STAMP[:3])
doc.core_properties.modified = datetime(*STAMP[:3])
doc.save(ROOT/'rules.docx')
normalize_zip(ROOT/'rules.docx')

book = Workbook()
sheet = book.active
sheet.title = 'Coding rules'
sheet.append(['Rule ID', 'Rule text'])
for i, rule in enumerate(RULES):
    sheet.append([f'DEMO-{i+1:02}', rule])
sheet.column_dimensions['A'].width = 14
sheet.column_dimensions['B'].width = 92
book.properties.created = datetime(*STAMP[:3])
book.properties.modified = datetime(*STAMP[:3])
book.save(ROOT/'rules.xlsx')
normalize_zip(ROOT/'rules.xlsx')

hashes = {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(ROOT.iterdir()) if p.suffix in {'.md','.pdf','.docx','.xlsx','.zip','.json','.log'} and p.name not in {'manifest.json','README.md'}}
(ROOT/'manifest.json').write_text(json.dumps({'synthetic':True,'sha256':hashes},indent=2)+'\n',encoding='utf-8')
print('Generated fixture formats: ZIP, MD, PDF, DOCX, XLSX; no operational data.')
