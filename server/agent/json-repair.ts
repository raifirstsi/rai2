export function repairJsonString(input: string): string {
  let cleaned = input.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces = Math.max(0, openBraces - 1);
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  if (inString) cleaned += '"';
  while (openBrackets > 0) { cleaned += ']'; openBrackets--; }
  while (openBraces > 0) { cleaned += '}'; openBraces--; }
  return cleaned;
}

export function safeJsonParse<T = unknown>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    try {
      const repaired = repairJsonString(input);
      return JSON.parse(repaired) as T;
    } catch {
      return fallback;
    }
  }
}
