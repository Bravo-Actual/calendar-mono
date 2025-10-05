export function extractTextForEmbedding(parts: Array<{ type: string; [k: string]: any }>): string {
  return parts
    .map((p) => {
      if (p.type === 'text' && typeof p.text === 'string') return p.text;
      if (p.type === 'reasoning' && typeof p.text === 'string') return p.text;
      if (p.type === 'function_call' && p.name) return `call:${p.name}`;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}
