export const RAI_MASCOT_LIBRARY = [
  { id: "mascot-1", name: "Capybara dễ thương làm việc cùng laptop", url: "/assets/mascots/mascot-1.png" },
  { id: "mascot-2", name: "Capybara vui vẻ dùng laptop RAI²", url: "/assets/mascots/mascot-2.png" },
  { id: "mascot-3", name: "Capybara suy tư cùng tai nghe RAI²", url: "/assets/mascots/mascot-3.png" },
  { id: "mascot-4", name: "Capybara hồng đeo tai nghe", url: "/assets/mascots/mascot-4.png" },
  { id: "mascot-5", name: "Capybara RAI² trong phòng thu", url: "/assets/mascots/mascot-5.png" },
  { id: "mascot-6", name: "Capybara bông đeo tai nghe", url: "/assets/mascots/mascot-6.png" },
  { id: "mascot-7", name: "Gấu bông Capybara đeo tai nghe RAI²", url: "/assets/mascots/mascot-7.png" },
  { id: "mascot-8", name: "Capybara với máy tính bảng phát sáng", url: "/assets/mascots/mascot-8.png" },
  { id: "mascot-9", name: "Capybara trà sữa RAI²", url: "/assets/mascots/mascot-9.png" },
  { id: "mascot-10", name: "Capybara nghe nhạc RAI²", url: "/assets/mascots/mascot-10.png" },
  { id: "mascot-11", name: "Capybara kính đen RAI²", url: "/assets/mascots/mascot-11.png" },
  { id: "mascot-12", name: "Capybara đỏ vui nhộn RAI²", url: "/assets/mascots/mascot-12.png" },
  { id: "mascot-13", name: "Capybara dùng điện thoại RAI²", url: "/assets/mascots/mascot-13.png" },
  { id: "mascot-14", name: "Capybara xám suy tư RAI²", url: "/assets/mascots/mascot-14.png" },
  { id: "mascot-15", name: "Capybara tím vui nhộn RAI²", url: "/assets/mascots/mascot-15.png" },
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
