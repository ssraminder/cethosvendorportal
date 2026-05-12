"""
Build .docx versions of the NDA templates from the HTML stored in
`nda_templates` for offline legal/HR reference. Run with:

    python scripts/build-nda-docx.py

Writes one file per active template into docs/nda-templates/.

The HTML schema is intentionally narrow (h2/h3/p/strong) so a minimal
HTML-to-Word pass is enough — no need to pull in a full converter.
"""
from __future__ import annotations

import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

# Hard-coded so we don't need to hit the DB at build time. Bump these
# verbatim from `SELECT version_label, body_html FROM nda_templates`
# whenever a new version goes live.
TEMPLATES = [
    {
        "version_label": "v1.0",
        "title": "Cethos Translator Confidentiality & Non-Disclosure Agreement",
        "effective_from": "2026-05-12",
        "body_html": """<h2>Cethos Translator Confidentiality &amp; Non-Disclosure Agreement</h2>
<p>This Confidentiality and Non-Disclosure Agreement ("Agreement") is entered into between <strong>Cethos Translation Services</strong> ("Cethos") and the undersigned vendor ("Translator") as of the date of acceptance below.</p>

<h3>1. Confidential Information</h3>
<p>"Confidential Information" means any non-public information disclosed by Cethos or its clients to the Translator in connection with translation, revision, review, proofreading, transcription, interpretation, or related services. This includes source documents, glossaries, translation memories, style guides, client identities, project metadata, pricing, and any other business or technical information not generally known to the public.</p>

<h3>2. Obligations</h3>
<p>The Translator agrees to: (a) keep all Confidential Information strictly confidential; (b) use it solely to perform the agreed services for Cethos; (c) not disclose it to any third party without Cethos's prior written consent, including any subcontractor, family member, friend, or AI/machine-translation service that retains or trains on input; (d) protect it with at least the same care used to protect their own confidential information, and never less than a reasonable standard of care; (e) destroy or return all copies upon Cethos's request or upon completion of services.</p>

<h3>3. AI and machine-translation tools</h3>
<p>Translator shall not input Confidential Information into any public or third-party AI or machine-translation service (including but not limited to Google Translate, DeepL Free, ChatGPT, Claude, Gemini) unless explicitly authorized in writing by Cethos for the specific project. Approved CAT tools with private, non-training infrastructure (e.g., Trados, MemoQ, Phrase) may be used per project instructions.</p>

<h3>4. Personal data and GDPR</h3>
<p>Where Confidential Information includes personal data (names, contact details, medical information, identity documents, etc.), Translator acts as a processor on behalf of Cethos and must comply with applicable data-protection law (including GDPR where the data subject is in the EU/UK). Translator shall promptly notify Cethos of any actual or suspected personal-data breach.</p>

<h3>5. Term and survival</h3>
<p>This Agreement takes effect on the date of acceptance and continues for so long as Translator engages with Cethos. The obligations of confidentiality survive termination indefinitely for trade secrets and for a period of five (5) years for all other Confidential Information.</p>

<h3>6. No grant of rights</h3>
<p>Nothing in this Agreement grants Translator any license, ownership, or other right in the Confidential Information except the limited right to use it to perform the agreed services.</p>

<h3>7. Remedies</h3>
<p>Translator acknowledges that any breach may cause irreparable harm to Cethos and its clients, and that monetary damages alone may be insufficient. Cethos may seek injunctive relief in addition to any other remedies available at law or in equity.</p>

<h3>8. Governing law</h3>
<p>This Agreement is governed by the laws of the Province of Alberta, Canada, without regard to its conflict-of-laws principles. Disputes shall be resolved in the courts of Alberta.</p>

<h3>9. Acceptance</h3>
<p>By typing your full legal name below and clicking "I agree", you confirm that you have read, understood, and agreed to be bound by this Agreement. You acknowledge that this electronic acceptance has the same legal effect as a handwritten signature.</p>""",
    },
    {
        "version_label": "v1.1",
        "title": "Cethos Translator Confidentiality & Non-Disclosure Agreement",
        "effective_from": "2026-05-12",
        "body_html": """<h2>Cethos Translator Confidentiality &amp; Non-Disclosure Agreement</h2>
<p>This Confidentiality and Non-Disclosure Agreement ("Agreement") is entered into between <strong>Cethos Translation Services</strong> ("Cethos") and the undersigned vendor ("Translator") as of the date of acceptance below.</p>

<h3>1. Confidential Information</h3>
<p>"Confidential Information" means any non-public information disclosed by Cethos or its clients to the Translator in connection with translation, revision, review, proofreading, transcription, interpretation, or related services. This includes source documents, glossaries, translation memories, style guides, client identities, project metadata, pricing, and any other business or technical information not generally known to the public.</p>

<h3>2. Obligations</h3>
<p>The Translator agrees to: (a) keep all Confidential Information strictly confidential; (b) use it solely to perform the agreed services for Cethos; (c) not disclose it to any third party without Cethos's prior written consent, including any subcontractor, family member, friend, or AI/machine-translation service that retains or trains on input; (d) protect it with at least the same care used to protect their own confidential information, and never less than a reasonable standard of care; (e) destroy or return all copies upon Cethos's request or upon completion of services.</p>

<h3>3. AI and machine-translation tools</h3>
<p>Translator shall not input Confidential Information into any public or third-party AI or machine-translation service (including but not limited to Google Translate, DeepL Free, ChatGPT, Claude, Gemini) unless explicitly authorized in writing by Cethos for the specific project. Approved CAT tools with private, non-training infrastructure (e.g., Trados, MemoQ, Phrase) may be used per project instructions.</p>

<h3>4. Personal data and GDPR</h3>
<p>Where Confidential Information includes personal data (names, contact details, medical information, identity documents, etc.), Translator acts as a processor on behalf of Cethos and must comply with applicable data-protection law (including GDPR where the data subject is in the EU/UK). Translator shall promptly notify Cethos of any actual or suspected personal-data breach.</p>

<h3>5. Term and survival</h3>
<p>This Agreement takes effect on the date of acceptance and continues for so long as Translator engages with Cethos. The obligations of confidentiality survive termination indefinitely for trade secrets and for a period of five (5) years for all other Confidential Information.</p>

<h3>6. No grant of rights</h3>
<p>Nothing in this Agreement grants Translator any license, ownership, or other right in the Confidential Information except the limited right to use it to perform the agreed services.</p>

<h3>7. Remedies</h3>
<p>Translator acknowledges that any breach may cause irreparable harm to Cethos and its clients, and that monetary damages alone may be insufficient. Cethos may seek injunctive relief in addition to any other remedies available at law or in equity.</p>

<h3>8. Governing law</h3>
<p>This Agreement is governed by the laws of the Province of Alberta, Canada, without regard to its conflict-of-laws principles. Disputes shall be resolved in the courts of Alberta.</p>

<h3>9. Acceptance</h3>
<p>By typing your full legal name below and clicking "I agree", you confirm that you have read, understood, and agreed to be bound by this Agreement. You acknowledge that this electronic acceptance has the same legal effect as a handwritten signature.</p>""",
    },
]


def html_unescape(s: str) -> str:
    """Cheap entity decode — we only emit &amp; &lt; &gt; &quot; in templates."""
    return (
        s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )


class ParaCollector(HTMLParser):
    """Walks the narrow HTML schema and yields (tag, [(bold, text), ...]).

    Bold runs are produced for <strong>/<b>; everything else is plain.
    """

    def __init__(self) -> None:
        super().__init__()
        self.paragraphs: list[tuple[str, list[tuple[bool, str]]]] = []
        self._current_tag: str | None = None
        self._current_runs: list[tuple[bool, str]] = []
        self._bold_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("h2", "h3", "p"):
            self._flush()
            self._current_tag = tag
            self._current_runs = []
        elif tag in ("strong", "b"):
            self._bold_depth += 1

    def handle_endtag(self, tag):
        if tag in ("h2", "h3", "p"):
            self._flush()
        elif tag in ("strong", "b"):
            self._bold_depth = max(0, self._bold_depth - 1)

    def handle_data(self, data):
        if self._current_tag is None:
            return
        text = html_unescape(data)
        if not text.strip() and not self._current_runs:
            return
        self._current_runs.append((self._bold_depth > 0, text))

    def _flush(self):
        if self._current_tag is None:
            return
        # Skip empty paragraphs.
        if any(run[1].strip() for run in self._current_runs):
            self.paragraphs.append((self._current_tag, self._current_runs))
        self._current_tag = None
        self._current_runs = []

    def close(self):
        self._flush()
        super().close()


def build_docx(template: dict, out_path: Path) -> None:
    doc = Document()

    # Page margins — slightly tighter than Word's 1in default.
    section = doc.sections[0]
    section.left_margin = Inches(0.9)
    section.right_margin = Inches(0.9)
    section.top_margin = Inches(0.9)
    section.bottom_margin = Inches(0.9)

    # Default style: 11pt Times for body, line spacing 1.15.
    base = doc.styles["Normal"]
    base.font.name = "Times New Roman"
    base.font.size = Pt(11)

    # Title block.
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("CETHOS SOLUTIONS INC.")
    run.font.name = "Calibri"
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)
    run.bold = True

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(template["title"])
    run.font.name = "Calibri"
    run.font.size = Pt(16)
    run.bold = True

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = meta.add_run(
        f"Version {template['version_label']}  ·  Effective {template['effective_from']}"
    )
    run.font.name = "Calibri"
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    doc.add_paragraph()  # spacing

    # Parse body.
    parser = ParaCollector()
    parser.feed(template["body_html"])
    parser.close()

    for tag, runs in parser.paragraphs:
        # First h2 in the doc is the agreement title — we already
        # rendered it as the page subtitle above, skip the duplicate.
        if tag == "h2" and not any(
            p.text and p.text.strip() not in (
                "CETHOS SOLUTIONS INC.",
                template["title"],
                meta.text.strip(),
            )
            for p in doc.paragraphs
        ):
            continue

        para = doc.add_paragraph()
        if tag == "h2":
            for bold, text in runs:
                r = para.add_run(text)
                r.font.name = "Calibri"
                r.font.size = Pt(13)
                r.bold = True
            continue
        if tag == "h3":
            for bold, text in runs:
                r = para.add_run(text)
                r.font.name = "Calibri"
                r.font.size = Pt(11.5)
                r.bold = True
                r.font.color.rgb = RGBColor(0x11, 0x18, 0x27)
            continue
        # <p>
        for bold, text in runs:
            r = para.add_run(text)
            r.bold = bold

    # Acceptance footer note — this template is executed electronically
    # via the vendor portal; the .docx is a reference copy of the text
    # that appears on screen at sign time.
    doc.add_paragraph()
    note = doc.add_paragraph()
    r = note.add_run(
        "This document is the reference copy of the Cethos Translator NDA. "
        "Vendors execute it electronically via the Cethos vendor portal "
        "(https://vendor.cethos.com/nda); the signed copy includes a "
        "verification audit log and is downloadable as a PDF."
    )
    r.italic = True
    r.font.size = Pt(9)
    r.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    doc.save(out_path)
    print(f"wrote {out_path}")


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    out_dir = repo_root / "docs" / "nda-templates"
    out_dir.mkdir(parents=True, exist_ok=True)
    for template in TEMPLATES:
        out = out_dir / f"cethos-nda-{template['version_label']}.docx"
        build_docx(template, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
