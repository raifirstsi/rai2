import { describe, it, expect } from "vitest";
import { convertOfficeDocument, convertCsvToTable } from "./office-convert.ts";
import { TurnSteeringManager } from "./turn-steering.ts";

describe("Sprint 2 Test Suite: Office Convert & Mid-Run Steering", () => {
  it("converts CSV raw text into structured markdown table", async () => {
    const csv = "Product,Price,Quantity\nApple,10,5\nBanana,5,12";
    const res = await convertOfficeDocument({
      filename: "inventory.csv",
      buffer: Buffer.from(csv, "utf-8"),
      mimeType: "text/csv"
    });
    expect(res.format).toBe("csv");
    expect(res.markdown).toContain("| Product | Price | Quantity |");
    expect(res.markdown).toContain("| Apple | 10 | 5 |");
    expect(res.rowCount).toBe(3);
  });

  it("handles plain text summary extraction", async () => {
    const text = "Company Financial Summary\nRevenue: $100K";
    const res = await convertOfficeDocument({
      filename: "financial.txt",
      buffer: Buffer.from(text, "utf-8")
    });
    expect(res.format).toBe("text");
    expect(res.markdown).toContain("Company Financial Summary");
  });

  it("manages mid-run turn steering directives correctly", () => {
    const mgr = new TurnSteeringManager();
    const turnId = "turn-test-123";

    expect(mgr.hasPendingSteer(turnId)).toBe(false);

    mgr.submitSteer(turnId, "redirect", "Focus on margin analysis instead");
    expect(mgr.hasPendingSteer(turnId)).toBe(true);

    const directives = mgr.consumeDirectives(turnId);
    expect(directives.length).toBe(1);
    expect(directives[0].action).toBe("redirect");
    expect(directives[0].instruction).toBe("Focus on margin analysis instead");

    // Once consumed, pending list should be empty
    expect(mgr.hasPendingSteer(turnId)).toBe(false);
  });
});
