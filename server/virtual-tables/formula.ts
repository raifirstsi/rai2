/**
 * Safe, dependency-aware Formula Evaluator for Virtual Tables.
 * Evaluates spreadsheet expressions without using unsafe raw eval().
 */

export interface FormulaContext {
  [key: string]: unknown;
}

const RESERVED_KEYWORDS = new Set([
  "Math", "abs", "round", "pow", "min", "max", "floor", "ceil", "sqrt",
  "true", "false", "null", "undefined", "NaN", "Infinity",
  "MARGIN", "MARKUP", "ROUND", "ABS", "MIN", "MAX", "IF"
]);

/** Extracts all column references in format `[Column Name]` or `[col_id]`, plus known column names */
export function extractDependencies(formula: string, knownColumns?: string[]): string[] {
  const matches = formula.match(/\[([^\]]+)\]/g);
  const deps = matches ? matches.map((m) => m.slice(1, -1).trim()) : [];

  if (knownColumns && knownColumns.length > 0) {
    // Also discover unbracketed column identifiers matching known columns
    const preprocessed = preprocessFormula(formula);
    const words = preprocessed.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    for (const w of words) {
      if (!RESERVED_KEYWORDS.has(w) && knownColumns.includes(w) && !deps.includes(w)) {
        deps.push(w);
      }
    }
  }

  return [...new Set(deps)];
}

/**
 * Normalizes common business functions in the expression:
 * - IF(cond, a, b) => ( (cond) ? (a) : (b) )
 * - ROUND(a, d) => Math.round((a) * Math.pow(10, d)) / Math.pow(10, d)
 * - MARGIN(rev, cost) => (((rev) - (cost)) / (rev) * 100)
 * - MARKUP(cost, marginPct) => ((cost) / (1 - (marginPct) / 100))
 * - MIN(...), MAX(...), ABS(...)
 */
function preprocessFormula(formula: string): string {
  let expr = formula.trim();

  // Strip leading '=' if present like in Excel
  if (expr.startsWith("=")) {
    expr = expr.slice(1).trim();
  }

  // Handle MARGIN(rev, cost)
  expr = expr.replace(/MARGIN\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, "((($1) - ($2)) / ($1) * 100)");

  // Handle MARKUP(cost, marginPct)
  expr = expr.replace(/MARKUP\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, "(($1) / (1 - ($2) / 100))");

  // Handle ROUND(x, n)
  expr = expr.replace(/ROUND\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, "(Math.round(($1) * Math.pow(10, $2)) / Math.pow(10, $2))");

  // Handle ABS(x)
  expr = expr.replace(/ABS\s*\(\s*([^)]+)\s*\)/gi, "Math.abs($1)");

  // Handle MIN(a, b)
  expr = expr.replace(/MIN\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, "Math.min($1, $2)");

  // Handle MAX(a, b)
  expr = expr.replace(/MAX\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, "Math.max($1, $2)");

  // Handle IF(cond, trueVal, falseVal) - handles nested IFs
  let prev = "";
  while (prev !== expr) {
    prev = expr;
    expr = expr.replace(/IF\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, "(($1) ? ($2) : ($3))");
  }

  return expr;
}

/** Safely evaluate a math / logic expression with provided context variables */
export function evaluateFormula(formula: string, context: FormulaContext): unknown {
  if (!formula || formula.trim() === "") return null;

  try {
    let expr = preprocessFormula(formula);

    // Identify dependencies (both bracketed and unbracketed known column names)
    const knownKeys = Object.keys(context);
    const deps = extractDependencies(formula, knownKeys);

    // Sort dependencies by length descending so longer column names are replaced first
    deps.sort((a, b) => b.length - a.length);

    for (const dep of deps) {
      const val = context[dep];
      let replacement: string;

      if (val === null || val === undefined) {
        replacement = "0";
      } else if (typeof val === "number") {
        replacement = String(val);
      } else if (typeof val === "boolean") {
        replacement = val ? "true" : "false";
      } else if (typeof val === "string") {
        // If numeric string, convert to number; otherwise JSON string
        const num = Number(val);
        replacement = !Number.isNaN(num) ? String(num) : JSON.stringify(val);
      } else {
        replacement = "0";
      }

      // Replace bracketed tokens `[dep]`
      const escapedDep = dep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regexBracketed = new RegExp(`\\[${escapedDep}\\]`, "g");
      expr = expr.replace(regexBracketed, replacement);

      // Also replace bare word occurrences `\bdep\b` if not part of a property access
      const regexBare = new RegExp(`\\b${escapedDep}\\b`, "g");
      expr = expr.replace(regexBare, replacement);
    }

    // Security check: strip string literals first, then only allow safe mathematical characters, keywords and Math functions
    const noStrings = expr.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
    const sanitized = noStrings.replace(/Math\.(abs|round|pow|min|max|floor|ceil|sqrt)/g, "");
    const forbidden = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
    const matches = sanitized.match(forbidden);
    if (matches) {
      // Allow only true, false, null
      const invalid = matches.filter((m) => !["true", "false", "null"].includes(m));
      if (invalid.length > 0) {
        throw new Error(`Formula contains unauthorized identifiers: ${invalid.join(", ")}`);
      }
    }

    // Evaluate in safe Function sandbox with only Math scope
    const evaluator = new Function("Math", `"use strict"; return (${expr});`);
    const result = evaluator(Math);

    if (typeof result === "number") {
      if (Number.isNaN(result) || !Number.isFinite(result)) return null;
      // Round float precision errors
      return Math.round(result * 1_000_000) / 1_000_000;
    }

    return result;
  } catch (err: any) {
    return { error: err?.message || "Calculation Error" };
  }
}

/** Topologically sorts columns by dependency graph, detects circular references */
export function sortColumnsByDependency(columns: { id: string; name: string; type: string; formula?: string }[]): {
  sorted: typeof columns;
  circularError?: string;
} {
  const colMap = new Map<string, typeof columns[0]>();
  const nameToId = new Map<string, string>();
  const allIdentifiers: string[] = [];

  for (const c of columns) {
    colMap.set(c.id, c);
    nameToId.set(c.name, c.id);
    allIdentifiers.push(c.id, c.name);
  }

  const adj = new Map<string, Set<string>>();
  for (const c of columns) {
    adj.set(c.id, new Set());
    if (c.type === "formula" && c.formula) {
      const deps = extractDependencies(c.formula, allIdentifiers);
      for (const d of deps) {
        const depId = colMap.has(d) ? d : nameToId.get(d);
        if (depId && depId !== c.id) {
          adj.get(c.id)!.add(depId);
        }
      }
    }
  }

  // Topological sort with cycle detection
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];
  let cycleFound: string | null = null;

  function visit(node: string, path: string[]) {
    if (cycleFound) return;
    if (visiting.has(node)) {
      cycleFound = `Circular dependency detected: ${[...path, node].join(" -> ")}`;
      return;
    }
    if (!visited.has(node)) {
      visiting.add(node);
      const neighbors = adj.get(node) || new Set();
      for (const next of neighbors) {
        visit(next, [...path, node]);
      }
      visiting.delete(node);
      visited.add(node);
      order.push(node);
    }
  }

  for (const c of columns) {
    if (!visited.has(c.id)) {
      visit(c.id, []);
    }
  }

  if (cycleFound) {
    return { sorted: columns, circularError: cycleFound };
  }

  const sorted = order.map((id) => colMap.get(id)!).filter(Boolean);
  return { sorted };
}
