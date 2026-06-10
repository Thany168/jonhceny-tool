import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

async function extractTextFromPDF(buffer: Buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
  });

  const pdf = await loadingTask.promise;

  let text = "";
  const pageCount = pdf.numPages;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");

    text += pageText + "\n\n";
  }

  return { text, pageCount };
}
