import { Code, Copy, Eye, FileCheck, Pencil, Pin, PinOff, RefreshCw, Square, Volume2 } from "lucide-react";
import { copyText } from "@/lib/copy-text";
import { t } from "@/lib/i18n";
import type { ConfigStatus, Group, Message, useStore } from "@/state/store";
import { ACTION_ICON, type MessageMenuItem } from "@/components/MessageActions";
import { useSpeakAction } from "@/components/SpeakButton";

export type PinAction = { pinned: boolean; onToggle: () => void; hint?: string };

export function roomPin(group: Group, message: Message, dispatch: ReturnType<typeof useStore>["dispatch"]): PinAction | undefined {
  if (window.ogb?.remoteClient?.active) return undefined;
  const pinned = group.pinnedMessageId === message.id;
  return {
    pinned,
    hint: t("room.pinHint"),
    onToggle: () => dispatch({ type: "patchGroup", groupId: group.id, patch: { pinnedMessageId: pinned ? "" : message.id } }),
  };
}

function pinItem(pin: PinAction | undefined): MessageMenuItem[] {
  if (!pin) return [];
  return [{
    key: "pin",
    icon: pin.pinned ? <PinOff {...ACTION_ICON} /> : <Pin {...ACTION_ICON} />,
    label: pin.pinned ? t("chat.unpinMessage") : t("chat.pinMessage"),
    title: pin.pinned ? t("chat.unpinHint") : pin.hint ?? t("chat.pinHint"),
    onSelect: pin.onToggle,
  }];
}

function idItem(messageId: string): MessageMenuItem {
  return { key: "copy-id", icon: <Copy {...ACTION_ICON} />, label: t("chat.copyMessageId"), onSelect: () => { void copyText(messageId); } };
}

export function useBotMessageMenu({
  text,
  botId,
  messageId,
  voiceId,
  tts,
  localVoice,
  canSpeak,
  viewRaw,
  onToggleRaw,
  onRegenerate,
  pin,
  onExtractSop,
}: {
  text: string;
  botId?: string;
  messageId: string;
  voiceId?: string;
  tts: ConfigStatus["tts"];
  localVoice: boolean;
  canSpeak: boolean;
  viewRaw: boolean;
  onToggleRaw: () => void;
  onRegenerate?: () => void;
  pin?: PinAction;
  onExtractSop?: () => void;
}): MessageMenuItem[] {
  const speak = useSpeakAction({ text, botId, messageId, voiceId, tts, localVoice });
  const items: MessageMenuItem[] = [];
  if (canSpeak && text) {
    items.push({
      key: "speak",
      icon: speak.mine ? <Square {...ACTION_ICON} /> : <Volume2 {...ACTION_ICON} />,
      label: speak.mine ? t("chat.speak.stop") : t("chat.speak.read"),
      title: speak.label,
      disabled: !speak.ready,
      onSelect: speak.toggle,
    });
  }
  if (text) {
    items.push({
      key: "raw",
      icon: viewRaw ? <Eye {...ACTION_ICON} /> : <Code {...ACTION_ICON} />,
      label: t(viewRaw ? "chat.showRenderedMarkdown" : "chat.showRawMarkdown"),
      onSelect: onToggleRaw,
    });
  }
  if (text && onExtractSop) {
    items.push({
      key: "extract-sop",
      icon: <FileCheck {...ACTION_ICON} />,
      label: "Đóng gói SOP (Voice-to-SOP)",
      title: "Đóng gói câu trả lời này thành SOP chuẩn 4 phần nạp vào Két Sắt",
      onSelect: onExtractSop,
    });
  }
  if (onRegenerate) items.push({ key: "regenerate", icon: <RefreshCw {...ACTION_ICON} />, label: t("chat.regenerate"), onSelect: onRegenerate });
  items.push(...pinItem(pin), idItem(messageId));
  return items;
}

export function userMessageMenu({
  messageId,
  onEdit,
  pin,
  onExtractSop,
}: {
  messageId: string;
  onEdit?: () => void;
  pin?: PinAction;
  onExtractSop?: () => void;
}): MessageMenuItem[] {
  return [
    ...(onEdit ? [{ key: "edit", icon: <Pencil {...ACTION_ICON} />, label: t("chat.editMessage"), onSelect: onEdit, idleOnly: true }] : []),
    ...(onExtractSop ? [{
      key: "extract-sop",
      icon: <FileCheck {...ACTION_ICON} />,
      label: "Đóng gói SOP (Voice-to-SOP)",
      title: "Đóng gói nội dung này thành SOP chuẩn 4 phần",
      onSelect: onExtractSop,
    }] : []),
    ...pinItem(pin),
    idItem(messageId),
  ];
}
