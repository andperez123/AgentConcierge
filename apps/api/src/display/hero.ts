import type { HeroDisplay, SetHeroBody } from "@concierge/shared";
import { getSetting, setSetting } from "../settings.js";

const HERO_KEY = "hero_display";

export function getHeroDisplay(): HeroDisplay | null {
  const raw = getSetting(HERO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HeroDisplay;
  } catch {
    return null;
  }
}

export function setHeroDisplay(body: SetHeroBody): HeroDisplay {
  const quote = body.quote.trim();
  if (!quote) throw new Error("quote is required");
  const hero: HeroDisplay = {
    quote,
    subtitle: body.subtitle?.trim() || undefined,
    imageUrl: body.imageUrl?.trim() || undefined,
    updatedAt: new Date().toISOString(),
    source: body.source ?? "openclaw",
  };
  setSetting(HERO_KEY, JSON.stringify(hero));
  return hero;
}
