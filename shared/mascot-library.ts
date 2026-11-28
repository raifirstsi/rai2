export const RAI_MASCOT_LIBRARY = [
  { id: "mascot-1", name: "Tinh thể muối công nghệ đáng yêu", url: "/assets/mascots/mascot-1.png" },
  { id: "mascot-2", name: "Tinh thể AI phát sáng đáng yêu", url: "/assets/mascots/mascot-2.png" },
  { id: "mascot-3", name: "Tinh thể muối lập trình đáng yêu", url: "/assets/mascots/mascot-3.png" },
  { id: "mascot-4", name: "Tinh thể muối công nghệ nháy mắt", url: "/assets/mascots/mascot-4.png" },
  { id: "mascot-5", name: "Tinh thể muối công nghệ rạng rỡ", url: "/assets/mascots/mascot-5.png" },
  { id: "mascot-6", name: "Tinh thể muối công nghệ vui nhộn", url: "/assets/mascots/mascot-6.png" },
  { id: "mascot-7", name: "Tinh thể pha lê công nghệ", url: "/assets/mascots/mascot-7.png" },
  { id: "mascot-8", name: "Tinh cầu pha lê công nghệ dễ thương", url: "/assets/mascots/mascot-8.png" },
  { id: "mascot-9", name: "Đá pha lê tròn trịa", url: "/assets/mascots/mascot-9.png" },
  { id: "mascot-10", name: "Đá pha lê băng giá đáng yêu", url: "/assets/mascots/mascot-10.png" },
  { id: "mascot-11", name: "Tinh thể giọt nước công nghệ", url: "/assets/mascots/mascot-11.png" },
  { id: "mascot-12", name: "Tinh thể giọt băng kỹ thuật số", url: "/assets/mascots/mascot-12.png" },
  { id: "mascot-13", name: "Tinh thể ngân hà rạng rỡ", url: "/assets/mascots/mascot-13.png" },
  { id: "mascot-14", name: "Tinh thể đá nháy mắt vui vẻ", url: "/assets/mascots/mascot-14.png" },
  { id: "mascot-15", name: "Tinh thể đá bo tròn phát sáng", url: "/assets/mascots/mascot-15.png" },
] as const;

export const RAI_MASCOT_URLS = RAI_MASCOT_LIBRARY.map((mascot) => mascot.url);
const RAI_MASCOT_URL_SET = new Set<string>(RAI_MASCOT_URLS);

export function isRaiMascotUrl(value: unknown): value is (typeof RAI_MASCOT_LIBRARY)[number]["url"] {
  return typeof value === "string" && RAI_MASCOT_URL_SET.has(value);
}

export function pickUnusedRaiMascotUrl(
  bots: ReadonlyArray<{ avatarUrl?: string | null }>,
  random: () => number = Math.random,
): (typeof RAI_MASCOT_LIBRARY)[number]["url"] {
  const used = new Set(bots.map((bot) => bot.avatarUrl).filter(isRaiMascotUrl));
  const unused = RAI_MASCOT_URLS.filter((url) => !used.has(url));
  const pool = unused.length ? unused : RAI_MASCOT_URLS;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
}

export function distinctNewBotAvatarUrl(
  requested: string | null | undefined,
  bots: ReadonlyArray<{ avatarUrl?: string | null }>,
  random: () => number = Math.random,
): string {
  if (requested && !isRaiMascotUrl(requested)) return requested;
  if (requested && !bots.some((bot) => bot.avatarUrl === requested)) return requested;
  return pickUnusedRaiMascotUrl(bots, random);
}
