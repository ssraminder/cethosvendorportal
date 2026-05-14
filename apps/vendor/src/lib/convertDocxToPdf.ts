/**
 * Client-side .docx → .pdf conversion for the CV-upload flow.
 *
 * The CV-upload backend (vendor-upload-cv edge function) only accepts
 * PDFs, and the vendor's CV is stored long-term in our private bucket
 * for ISO 17100 evidence. So when the vendor picks a .docx file we
 * convert it here in the browser before upload — the backend never
 * sees the .docx.
 *
 * Pipeline: mammoth → HTML → jsPDF.html(...) → PDF Blob.
 *
 * mammoth extracts the document's text + heading structure (it ignores
 * absolute positioning and complex Word features). That's fine for a
 * CV: what matters is readable content, not pixel-perfect Word layout.
 * The output is a clean letter-sized PDF with the same content, ready
 * for staff review.
 */

import { jsPDF } from "jspdf";

// Mammoth is ~600 KB minified — heavy for a feature most vendors never
// use. Lazy-load only when a vendor actually picks a .docx.
async function loadMammoth() {
  const mod = await import("mammoth");
  // Some bundlers wrap default exports; tolerate both shapes.
  return (mod as unknown as { default?: typeof import("mammoth") }).default ?? (mod as unknown as typeof import("mammoth"));
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isDocxFile(file: File): boolean {
  if (file.type === DOCX_MIME) return true;
  // Some browsers / OSes send empty content-type for docx; check the
  // extension as a fallback.
  return /\.docx$/i.test(file.name);
}

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name);
}

/**
 * Convert a .docx File to a PDF File. The returned File has the same
 * base name as the input with the extension swapped to .pdf.
 *
 * Throws if mammoth can't parse the file (corrupt / not a real docx).
 */
export async function convertDocxToPdf(docxFile: File): Promise<File> {
  if (!isDocxFile(docxFile)) {
    throw new Error("Not a .docx file");
  }

  const arrayBuffer = await docxFile.arrayBuffer();
  const mammoth = await loadMammoth();
  const { value: html } = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      // Map common Word styles to sensible HTML tags so jsPDF.html()
      // renders them with reasonable spacing.
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='List Paragraph'] => p.list:fresh",
        "b => strong",
        "i => em",
      ],
    },
  );

  // jsPDF.html() reads layout from a real DOM element, so park the
  // converted HTML in an offscreen div with print-friendly styles.
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = "612pt";        // US Letter width
  container.style.padding = "40pt";       // ~0.55in margins
  container.style.background = "white";
  container.style.color = "#111";
  container.style.fontFamily = "Helvetica, Arial, sans-serif";
  container.style.fontSize = "11pt";
  container.style.lineHeight = "1.45";
  container.innerHTML = `
    <style>
      h1 { font-size: 18pt; margin: 0 0 8pt; font-weight: 700; }
      h2 { font-size: 14pt; margin: 14pt 0 6pt; font-weight: 700; }
      h3 { font-size: 12pt; margin: 12pt 0 4pt; font-weight: 700; }
      h4 { font-size: 11pt; margin: 10pt 0 4pt; font-weight: 700; }
      p  { margin: 0 0 6pt; }
      ul, ol { margin: 0 0 6pt; padding-left: 20pt; }
      li { margin: 0 0 3pt; }
      table { border-collapse: collapse; margin: 6pt 0; }
      td, th { border: 0.5pt solid #999; padding: 3pt 6pt; vertical-align: top; }
      strong { font-weight: 700; }
      em { font-style: italic; }
    </style>
    ${html}
  `;
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true });
    await pdf.html(container, {
      // Render the container at its natural width into the PDF page.
      x: 0,
      y: 0,
      width: 612,
      windowWidth: 612,
      autoPaging: "text",       // split long content across pages on text boundaries
      margin: [0, 0, 0, 0],     // padding's in the container itself
    });
    const blob = pdf.output("blob");
    const baseName = docxFile.name.replace(/\.docx$/i, "");
    return new File([blob], `${baseName}.pdf`, { type: "application/pdf" });
  } finally {
    document.body.removeChild(container);
  }
}
