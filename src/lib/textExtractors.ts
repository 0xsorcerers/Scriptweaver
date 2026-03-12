function stripRtf(rtfText: string): string {
  return rtfText
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-fA-F]{2}/g, '')
    .replace(/\\[a-z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractFromPdfBuffer(buffer: ArrayBuffer): string {
  const content = new Uint8Array(buffer);
  const raw = new TextDecoder('latin1').decode(content);
  const matches = [...raw.matchAll(/\(([^)]{2,160})\)/g)].map((m) => m[1]);
  return matches.join(' ').replace(/\s+/g, ' ').trim();
}

function extractFromDocxBuffer(buffer: ArrayBuffer): string {
  const raw = new TextDecoder().decode(new Uint8Array(buffer));
  const matches = [...raw.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((m) => m[1]);
  const fromXml = matches.join(' ');
  if (fromXml.trim()) {
    return fromXml.replace(/\s+/g, ' ').trim();
  }

  return raw.replace(/[^\x20-\x7E\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    return file.text();
  }

  if (extension === 'rtf') {
    return stripRtf(await file.text());
  }

  if (extension === 'pdf') {
    return extractFromPdfBuffer(await file.arrayBuffer());
  }

  if (extension === 'docx' || extension === 'doc') {
    return extractFromDocxBuffer(await file.arrayBuffer());
  }

  throw new Error('Unsupported file format. Upload .txt, .rtf, .pdf, .doc, or .docx');
}
