import { describe, expect, it } from "vitest";
import { localizeGreetingMessage, localizeSetupChoices } from "./localize-greeting";
import type { Message } from "@/state/store";

describe("localize-greeting", () => {
  it("localizes English default setup choices when active locale is Vietnamese", () => {
    const enChoices = [
      "Research and digging into topics",
      "Keeping an eye on things for me",
      "Email, calendar and messages",
      "Bookings, shopping and errands",
      "Data, spreadsheets and reports",
    ];
    const localized = localizeSetupChoices(enChoices, "vi");
    expect(localized).toHaveLength(5);
  });

  it("converts default greeting message between English and Vietnamese based on locale", () => {
    const enMessage: Message = {
      id: "m-1",
      role: "bot",
      kind: "text",
      text: "Hi, I'm Nimbus. What would you like me to do?",
      at: 1000,
      setupOffer: true,
    };
    const viMessage = localizeGreetingMessage(enMessage, "Nimbus", "vi");
    expect(viMessage.text).toBe("Chào bạn, mình là Nimbus. Bạn muốn mình giúp gì?");

    const backToEn = localizeGreetingMessage(viMessage, "Nimbus", "en");
    expect(backToEn.text).toBe("Hi, I'm Nimbus. What would you like me to do?");
  });
});
