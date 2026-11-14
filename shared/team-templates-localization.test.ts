import { describe, expect, it } from "vitest";
import {
  isVietnamese,
  localizeAgentDescription,
  localizePackageManifest,
  localizeRoleTitle,
  localizeTeamDescription,
  localizeTeamName,
} from "./team-templates-localization";

describe("team-templates-localization", () => {
  it("detects Vietnamese locale", () => {
    expect(isVietnamese("vi")).toBe(true);
    expect(isVietnamese("vi-VN")).toBe(true);
    expect(isVietnamese("en")).toBe(false);
    expect(isVietnamese(undefined)).toBe(false);
  });

  it("localizes team names in Vietnamese", () => {
    expect(localizeTeamName("Find SEO Growth Opportunities", "vi")).toBe("Nhóm tăng trưởng SEO");
    expect(localizeTeamName("SEO Growth Team", "vi")).toBe("Nhóm tăng trưởng SEO");
    expect(localizeTeamName("Ship Software Safely", "vi")).toBe("Đội ngũ kỹ thuật phần mềm");
    expect(localizeTeamName("Find SEO Growth Opportunities", "en")).toBe("Find SEO Growth Opportunities");
  });

  it("localizes team description in Vietnamese", () => {
    const original = "A four-agent search team that maps demand, diagnoses technical constraints, creates useful briefs, and consolidates the work into a practical roadmap grounded in the evidence you provide.";
    const vi = localizeTeamDescription("Find SEO Growth Opportunities", original, "vi");
    expect(vi).toContain("Đội ngũ 4 chuyên gia tìm kiếm");
    expect(localizeTeamDescription("Find SEO Growth Opportunities", original, "en")).toBe(original);
  });

  it("localizes member titles", () => {
    expect(localizeRoleTitle("SEO Strategist", "vi")).toBe("Chiến lược gia SEO");
    expect(localizeRoleTitle("Keyword Researcher", "vi")).toBe("Nghiên cứu từ khóa");
    expect(localizeRoleTitle("Technical SEO Auditor", "vi")).toBe("Kiểm toán SEO kỹ thuật");
    expect(localizeRoleTitle("SEO Content Editor", "vi")).toBe("Biên tập nội dung SEO");
    expect(localizeRoleTitle("Tech Lead", "vi")).toBe("Trưởng nhóm kỹ thuật");
    expect(localizeRoleTitle("SEO Strategist", "en")).toBe("SEO Strategist");
  });

  it("localizes member descriptions", () => {
    const novaVi = localizeAgentDescription("nova", "Own the search strategy and turn business goals into a prioritized SEO roadmap.", "vi");
    expect(novaVi).toContain("Chủ trì chiến lược tìm kiếm");

    const nova2Vi = localizeAgentDescription("Nova 2", "Own the search strategy and turn business goals into a prioritized SEO roadmap.", "vi");
    expect(nova2Vi).toContain("Chủ trì chiến lược tìm kiếm");
  });

  it("localizes package manifest completely", () => {
    const raw = {
      format: "openmaus.package",
      version: 1,
      package: {
        id: "seo-growth",
        name: "Find SEO Growth Opportunities",
        summary: "A four-agent search team...",
        agents: [
          { key: "nova", name: "Nova", title: "SEO Strategist", description: "Own the search strategy..." },
          { key: "scout", name: "Scout", title: "Keyword Researcher", description: "Find useful..." },
        ],
        rooms: [
          { key: "seo-growth-room", name: "SEO Growth Room", bulletin: "Work from evidence..." }
        ],
      },
    };

    const viPkg = localizePackageManifest(raw, "vi");
    expect(viPkg.package.name).toBe("Nhóm tăng trưởng SEO");
    expect(viPkg.package.agents[0].title).toBe("Chiến lược gia SEO");
    expect(viPkg.package.agents[0].description).toContain("Chủ trì chiến lược tìm kiếm");
    expect(viPkg.package.rooms[0].name).toBe("Phòng Tăng trưởng SEO");

    // English preserves original
    const enPkg = localizePackageManifest(raw, "en");
    expect(enPkg.package.name).toBe("Find SEO Growth Opportunities");
    expect(enPkg.package.agents[0].title).toBe("SEO Strategist");
  });
});
