import { activeLocale, t } from "@/lib/i18n";
import type { LocaleKey } from "@/locales";
import type { Message } from "@/state/store";

export const FALLBACK_CHOICES: LocaleKey[] = [
  "chat.setupCard.research",
  "chat.setupCard.watch",
  "chat.setupCard.inbox",
  "chat.setupCard.errands",
  "chat.setupCard.data",
];

const KNOWN_EN_CHOICES = new Set([
  "research and digging into topics",
  "keeping an eye on things for me",
  "email, calendar and messages",
  "bookings, shopping and errands",
  "data, spreadsheets and reports",
]);

const KNOWN_VI_CHOICES = new Set([
  "nghiên cứu và đào sâu vào chủ đề",
  "để mắt tới mọi thứ giúp tôi",
  "email, lịch và tin nhắn",
  "đặt chỗ, mua sắm và việc vặt",
  "dữ liệu, bảng tính và báo cáo",
]);

export function isDefaultSetupChoiceList(choices: readonly string[]): boolean {
  if (!choices.length) return true;
  return choices.some(
    (c) =>
      KNOWN_EN_CHOICES.has(c.trim().toLowerCase()) ||
      KNOWN_VI_CHOICES.has(c.trim().toLowerCase()),
  );
}

export function localizeSetupChoices(
  choices: readonly string[] | undefined,
  locale = activeLocale(),
): string[] {
  if (!choices || !choices.length) {
    return FALLBACK_CHOICES.map((key) => t(key));
  }
  if (isDefaultSetupChoiceList(choices)) {
    if (locale === "vi") {
      return FALLBACK_CHOICES.map((key) => t(key));
    }
    if (locale === "en") {
      return [
        "Research and digging into topics",
        "Keeping an eye on things for me",
        "Email, calendar and messages",
        "Bookings, shopping and errands",
        "Data, spreadsheets and reports",
      ];
    }
    return FALLBACK_CHOICES.map((key) => t(key));
  }
  return [...choices];
}

export function localizeGreetingMessage(
  message: Message,
  botName: string,
  locale = activeLocale(),
): Message {
  if (!message.text) return message;
  const isEnGreeting =
    /^Hi(?: [^,]+)?, I'm (.+?)\. What would you like me to do\?$/i.test(message.text.trim());
  const isViGreeting =
    /^Chào(?: [^,]+)?, mình là (.+?)\. Bạn muốn mình giúp gì\?$/i.test(message.text.trim());

  if (locale === "vi" && isEnGreeting) {
    return {
      ...message,
      text: `Chào bạn, mình là ${botName}. Bạn muốn mình giúp gì?`,
    };
  }
  if (locale === "en" && isViGreeting) {
    return {
      ...message,
      text: `Hi, I'm ${botName}. What would you like me to do?`,
    };
  }
  return message;
}
