import { RAI2_DEPARTMENTS, RaiDepartment } from "./rai2-departments";
import { TocDiagnosisResult } from "./toc-detector";

export type ZoneHealthStatus = "HEALTHY" | "WARNING" | "CRITICAL_TOC";

export interface ZoneEvaluation {
  zoneNumber: number;
  code: string;
  name: string;
  englishZone: string;
  description: string;
  iconName: string;
  status: ZoneHealthStatus;
  activeAgentsCount: number;
  activeBotKeys: string[];
  totalExpectedAgents: number;
  isConstraintZone: boolean;
  weight: number;
  urgencyWarning?: string;
  actionRecommendation: string;
}

export interface StrategyMapSummary {
  evaluatedAt: string;
  overallCoverageScore: number;
  healthyZonesCount: number;
  warningZonesCount: number;
  criticalZonesCount: number;
  primaryBottleneckZone: number | null;
  zones: ZoneEvaluation[];
}

const ZONE_WEIGHTS: Record<number, number> = {
  1: 0.15, // Strategy & Governance
  2: 0.15, // Marketing
  3: 0.20, // Sales & Quoting
  4: 0.20, // Delivery & Ops
  5: 0.10, // Customer Care
  6: 0.10, // Finance & P&L
  7: 0.10, // HR & Training
};

export type ActiveBotCandidate =
  | string
  | {
      id: string;
      name?: string;
      title?: string;
      section?: string;
      zone?: number;
    };

export function evaluateStrategyMap7Zones(params: {
  activeBotIds?: string[];
  activeBots?: ActiveBotCandidate[];
  tocDiagnosis?: TocDiagnosisResult | null;
}): StrategyMapSummary {
  const { activeBotIds = [], activeBots, tocDiagnosis } = params;

  const allCandidates: ActiveBotCandidate[] = [
    ...(activeBots || []),
    ...activeBotIds,
  ];

  const botObjects = allCandidates.filter(
    (c): c is Exclude<ActiveBotCandidate, string> => typeof c === "object" && c !== null
  );

  const stringTokens = allCandidates
    .flatMap((c) => {
      if (typeof c === "string") return [c];
      return [c.id, c.name, c.title, c.section].filter(Boolean) as string[];
    })
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.trim().toLowerCase());

  const activeSet = new Set(stringTokens);
  const constraintZoneNumber = tocDiagnosis?.zoneNumber || null;

  const evaluatedZones: ZoneEvaluation[] = RAI2_DEPARTMENTS.map((dept: RaiDepartment) => {
    // 1. Explicit zone match from bot metadata (DETERMINISTIC)
    const directZoneBots = botObjects.filter((b) => b.zone === dept.zone);
    const directSectionBots = botObjects.filter((b) => {
      if (!b.section) return false;
      const s = b.section.toLowerCase();
      return (
        s === dept.name.toLowerCase() ||
        s === dept.code.toLowerCase() ||
        s.includes(`vùng ${dept.zone}`) ||
        s.includes(`zone ${dept.zone}`) ||
        s.includes(`z${dept.zone}`)
      );
    });

    // 2. Keyword/Agent matching
    const activeKeysInDept = dept.agents
      .map((a) => a.key)
      .filter((k) => {
        const kLower = k.toLowerCase();
        if (activeSet.has(kLower)) return true;

        const agent = dept.agents.find((ag) => ag.key === k);
        const nameLower = agent?.name.toLowerCase();
        const titleLower = agent?.title?.toLowerCase();

        if (nameLower && activeSet.has(nameLower)) return true;
        if (titleLower && activeSet.has(titleLower)) return true;

        const bareKey = kLower.replace(/^rai[-_]/, "");

        return stringTokens.some((tok) => {
          if (tok.includes(kLower) || kLower.includes(tok)) return true;
          if (bareKey.length >= 3 && (tok.includes(bareKey) || bareKey.includes(tok))) return true;
          if (nameLower && (tok.includes(nameLower) || nameLower.includes(tok))) return true;
          if (titleLower && (tok.includes(titleLower) || titleLower.includes(tok))) return true;
          return false;
        });
      });

    const matchedKeys = new Set<string>([
      ...activeKeysInDept,
      ...directZoneBots.map((b) => b.id || b.name || `bot-zone-${dept.zone}`),
      ...directSectionBots.map((b) => b.id || b.name || `bot-section-${dept.zone}`),
    ]);

    const activeCount = matchedKeys.size;
    const isConstraint = constraintZoneNumber === dept.zone;

    let status: ZoneHealthStatus = "HEALTHY";
    let urgencyWarning: string | undefined;
    let actionRecommendation = "Phòng ban đã có nhân sự số phụ trách và vận hành ổn định.";

    if (isConstraint) {
      status = "CRITICAL_TOC";
      urgencyWarning = `ĐIỂM NGHẼN CỐT TỬ (TOC): ${tocDiagnosis?.title || "Cần giải tỏa ngay để khơi thông dòng tiền"}`;
      actionRecommendation = `Ưu tiên số 1: Kích hoạt ngay ${dept.agents[0]?.name || "nhân sự số"} để giải phóng điểm nghẽn này.`;
    } else if (activeCount === 0) {
      status = "WARNING";
      urgencyWarning = "Chưa có nhân sự số nào phụ trách, tiềm ẩn nguy cơ phụ thuộc vào người chủ.";
      actionRecommendation = `Tuyển ${dept.agents[0]?.name || "nhân sự số"} để tự động hóa nghiệp vụ khâu này.`;
    }

    return {
      zoneNumber: dept.zone,
      code: dept.code,
      name: dept.name,
      englishZone: dept.englishZone,
      description: dept.description,
      iconName: dept.iconName,
      status,
      activeAgentsCount: activeCount,
      activeBotKeys: Array.from(matchedKeys),
      totalExpectedAgents: dept.agents.length,
      isConstraintZone: isConstraint,
      weight: ZONE_WEIGHTS[dept.zone] || 0.1,
      urgencyWarning,
      actionRecommendation,
    };
  });

  // Calculate weighted overall coverage score
  const totalScore = evaluatedZones.reduce((acc, z) => {
    const coverage = Math.min(1, z.activeAgentsCount / Math.max(1, z.totalExpectedAgents));
    const penalty = z.isConstraintZone && z.activeAgentsCount === 0 ? 0.3 : 1;
    return acc + coverage * z.weight * penalty * 100;
  }, 0);

  const overallCoverageScore = Math.min(100, Math.round(totalScore));
  const healthyZonesCount = evaluatedZones.filter((z) => z.status === "HEALTHY").length;
  const warningZonesCount = evaluatedZones.filter((z) => z.status === "WARNING").length;
  const criticalZonesCount = evaluatedZones.filter((z) => z.status === "CRITICAL_TOC").length;

  return {
    evaluatedAt: new Date().toISOString(),
    overallCoverageScore,
    healthyZonesCount,
    warningZonesCount,
    criticalZonesCount,
    primaryBottleneckZone: constraintZoneNumber,
    zones: evaluatedZones,
  };
}
