import type { SourceType } from "./types";

export function detectSource(url: string): SourceType | null {
  let host: string;
  try {
    host = new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)(instagram\.com|instagr\.am)$/.test(host)) return "instagram";
  return "web";
}

/** Pull the first URL out of pasted share text like "Check this out! https://vm.tiktok.com/xyz/". */
export function extractUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s]+/);
  return (m ? m[0] : text).trim();
}

export function sourceLabel(type: SourceType, name: string | null): string {
  if (type === "tiktok") return "TikTok";
  if (type === "instagram") return "Instagram";
  return name || "website";
}

export const SOURCE_ICON: Record<SourceType, string> = { tiktok: "♪", instagram: "◎", web: "🔗" };
