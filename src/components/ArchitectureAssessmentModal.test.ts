import { describe, it, expect } from "vitest";
import { ArchitectureAssessmentModal } from "./ArchitectureAssessmentModal";

describe("ArchitectureAssessmentModal - Component Export & Contract", () => {
  it("exports ArchitectureAssessmentModal as a functional component", () => {
    expect(typeof ArchitectureAssessmentModal).toBe("function");
  });
});
