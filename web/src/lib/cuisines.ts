import list from "../../../shared/cuisines.json";

// Same list the worker's Claude schema enforces.
export const CUISINES: string[] = list;

const FLAGS: Record<string, string> = {
  Italian: "🍝", Mexican: "🌮", Chinese: "🥡", Japanese: "🍣", Korean: "🥢", Thai: "🌶️",
  Vietnamese: "🍜", Indian: "🍛", "Middle Eastern": "🧆", "Mediterranean/Greek": "🫒", French: "🥐",
  American: "🍔", "Southern/BBQ": "🍖", Caribbean: "🥥", "Latin American": "🫓", African: "🍲",
  Fusion: "✨", Other: "🍽️",
};

export const cuisineEmoji = (c: string) => FLAGS[c] ?? "🍽️";
