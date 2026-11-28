import { getWorkspaceAuditLedger } from "./agent/merkle-audit.ts";

export interface DlpRedactionItem {
  type: "api_key" | "private_key" | "bearer_token" | "jwt_token" | "db_uri" | "bank_card" | "forbidden_term";
  count: number;
}

export interface DlpScanResult {
  sanitizedText: string;
  redactions: DlpRedactionItem[];
  blocked: boolean;
  blockReason?: string;
}

const SECRET_RULES: Array<{ type: DlpRedactionItem["type"]; regex: RegExp; placeholder: string }> = [
  {
    type: "private_key",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    placeholder: "[REDACTED_PRIVATE_KEY]",
  },
  {
    type: "api_key",
    regex: /\b(?:sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|sk-or-v1-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|gsk_[A-Za-z0-9]{20,}|xai-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/g,
    placeholder: "[REDACTED_API_KEY]",
  },
  {
    type: "jwt_token",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    placeholder: "[REDACTED_JWT]",
  },
  {
    type: "db_uri",
    regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@]+:[^\s@]+@[^\s/]+/gi,
    placeholder: "[REDACTED_DB_URI]",
  },
  {
    type: "bearer_token",
    regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi,
    placeholder: "Bearer [REDACTED_TOKEN]",
  },
  {
    type: "bank_card",
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    placeholder: "[REDACTED_CARD]",
  },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Inbound DLP & Outbound Censorship scanner.
 * Deterministically masks secrets/PII and enforces company-specific censorship keywords.
 */
export function scanAndRedactText(
  rawText: string,
  options?: {
    dlpEnabled?: boolean;
    censorshipEnabled?: boolean;
    forbiddenTopics?: readonly string[];
    blockOnForbiddenTopic?: boolean;
    auditActor?: string;
    auditAction?: string;
  },
): DlpScanResult {
  if (!rawText) {
    return { sanitizedText: rawText, redactions: [], blocked: false };
  }
  let text = rawText;
  const counts = new Map<DlpRedactionItem["type"], number>();

  if (options?.dlpEnabled !== false) {
    for (const rule of SECRET_RULES) {
      let matched = 0;
      text = text.replace(rule.regex, () => {
        matched += 1;
        return rule.placeholder;
      });
      if (matched > 0) {
        counts.set(rule.type, (counts.get(rule.type) ?? 0) + matched);
      }
    }
  }

  let blocked = false;
  let blockReason: string | undefined;

  if (options?.censorshipEnabled !== false && Array.isArray(options?.forbiddenTopics)) {
    for (const rawTerm of options.forbiddenTopics) {
      const term = rawTerm.trim();
      if (!term) continue;
      const re = new RegExp(escapeRegex(term), "gi");
      let matched = 0;
      text = text.replace(re, () => {
        matched += 1;
        return "[CENSORED_POLICY]";
      });
      if (matched > 0) {
        counts.set("forbidden_term", (counts.get("forbidden_term") ?? 0) + matched);
        if (options.blockOnForbiddenTopic) {
          blocked = true;
          blockReason = `Vi phạm chính sách kiểm duyệt nội bộ: "${term}"`;
        }
      }
    }
  }

  const redactions: DlpRedactionItem[] = [...counts.entries()].map(([type, count]) => ({ type, count }));
  if (redactions.length > 0 && options?.auditActor) {
    getWorkspaceAuditLedger().append(
      "default",
      options.auditActor,
      options.auditAction ?? "dlp_censorship_triggered",
      { redactions, blocked, blockReason: blockReason ?? null },
    );
  }

  return { sanitizedText: text, redactions, blocked, blockReason };
}
