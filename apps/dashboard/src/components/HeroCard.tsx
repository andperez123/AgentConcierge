import { Quote } from "lucide-react";
import type { HeroDisplay } from "@concierge/shared";

const DEFAULT_QUOTE = "Focus on progress, not perfection.";
const DEFAULT_SUBTITLE = "Let's get things done.";

interface Props {
  hero: HeroDisplay | null | undefined;
}

export default function HeroCard({ hero }: Props) {
  const quote = hero?.quote ?? DEFAULT_QUOTE;
  const subtitle = hero?.subtitle ?? DEFAULT_SUBTITLE;
  const bgStyle = hero?.imageUrl
    ? { backgroundImage: `linear-gradient(180deg, rgba(13,13,13,0.5) 0%, rgba(13,13,13,0.85) 100%), url(${hero.imageUrl})` }
    : undefined;

  return (
    <article className="dash-card hero-card">
      <div className="hero-card__bg" style={bgStyle} aria-hidden />
      <div className="hero-card__content">
        <Quote className="hero-card__quote-icon" size={34} strokeWidth={2} />
        <p className="hero-card__quote">{quote}</p>
        {subtitle && <p className="hero-card__subtitle">{subtitle}</p>}
      </div>
    </article>
  );
}
