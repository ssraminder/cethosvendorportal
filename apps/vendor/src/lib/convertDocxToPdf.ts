/**
 * Client-side .docx → .pdf conversion for CV uploads.
 *
 * Two-pass:
 *   1. mammoth → HTML (extracts text, headings, lists, tables, bold/italic).
 *   2. html2canvas → canvas → jsPDF.addImage with per-page slicing.
 *
 * Why not jsPDF.html()? The first cut used jsPDF.html() which drives
 * html2canvas under the hood but sometimes produced blank PDFs on real
 * CVs (offscreen positioning + autoPaging quirks). Running html2canvas
 * directly + adding the canvas as a paginated image is more predictable.
 * html2canvas is already in the vendor bundle (bug-report screenshot uses
 * it), so the only extra weight is mammoth itself (lazy-loaded).
 *
 * The original docx is preserved alongside the PDF on upload — see
 * vendor-upload-cv `source_docx` form field.
 */

import { jsPDF } from "jspdf";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isDocxFile(file: File): boolean {
  if (file.type === DOCX_MIME) return true;
  return /\.docx$/i.test(file.name);
}

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name);
}

// Mammoth is ~600 KB minified. Lazy-load so the main bundle stays small.
async function loadMammoth(): Promise<typeof import("mammoth")> {
  const mod = await import("mammoth");
  return (mod as unknown as { default?: typeof import("mammoth") }).default
    ?? (mod as unknown as typeof import("mammoth"));
}

async function loadHtml2Canvas() {
  const mod = await import("html2canvas");
  return (mod as unknown as { default: typeof import("html2canvas").default }).default;
}

function waitForFontsAndLayout(): Promise<void> {
  // Two RAFs lets the browser run layout for the freshly-inserted node.
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          try { await document.fonts.ready; } catch { /* ignore */ }
        }
        resolve();
      });
    });
  });
}

/**
 * Convert a .docx File to a PDF File. Same base name, .pdf extension.
 * Throws if mammoth can't parse the file or html2canvas captures nothing.
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

  // Render container offscreen (left:-99999px), but with a real width so
  // html2canvas captures a sensible layout. Keep it in normal flow so the
  // browser actually computes layout / fonts before snapshot.
  const RENDER_WIDTH_PX = 794; // ~A4 width at 96dpi, also reads well for letter
  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "top:0",
    "left:-99999px",
    `width:${RENDER_WIDTH_PX}px`,
    "padding:48px",
    "background:#ffffff",
    "color:#111",
    "font-family:Helvetica,Arial,sans-serif",
    "font-size:14px",
    "line-height:1.5",
    "box-sizing:border-box",
  ].join(";");
  container.innerHTML = `
    <style>
      h1 { font-size: 22px; margin: 0 0 10px; font-weight: 700; }
      h2 { font-size: 18px; margin: 18px 0 8px; font-weight: 700; }
      h3 { font-size: 16px; margin: 14px 0 6px; font-weight: 700; }
      h4 { font-size: 14px; margin: 12px 0 4px; font-weight: 700; }
      p, li { margin: 0 0 8px; }
      ul, ol { margin: 0 0 8px; padding-left: 24px; }
      table { border-collapse: collapse; margin: 8px 0; width: 100%; }
      td, th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
      strong { font-weight: 700; }
      em { font-style: italic; }
      a { color: #0a58ca; text-decoration: underline; }
      img { max-width: 100%; height: auto; }
    </style>
    ${html}
  `;
  document.body.appendChild(container);

  try {
    await waitForFontsAndLayout();

    const html2canvas = await loadHtml2Canvas();
    const canvas = await html2canvas(container, {
      scale: 1.5,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: RENDER_WIDTH_PX,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("html2canvas produced a 0×0 canvas");
    }

    const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Scale canvas to page width; height is whatever it works out to.
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Slice the (potentially tall) canvas across multiple pages by
    // shifting the image up by `pageHeight` per page. The canvas is
    // anchored at y = -position; only the visible page slice renders.
    let position = 0;
    let pageNum = 0;
    while (position < imgHeight) {
      if (pageNum > 0) pdf.addPage();
      pdf.addImage(
        canvas,
        "JPEG",
        0,
        -position,
        imgWidth,
        imgHeight,
        undefined,
        "FAST",
      );
      position += pageHeight;
      pageNum++;
      // Safety: bail out if the document is ridiculously long.
      if (pageNum > 50) break;
    }

    const blob = pdf.output("blob");
    const baseName = docxFile.name.replace(/\.docx$/i, "");
    return new File([blob], `${baseName}.pdf`, { type: "application/pdf" });
  } finally {
    document.body.removeChild(container);
  }
}
