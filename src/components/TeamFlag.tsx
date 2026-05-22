import { getFlagEmoji, getFlagUrl } from '../lib/flags';

interface TeamFlagProps {
  name?: string | null;
  code?: string | null;
  className?: string;
  imageClassName?: string;
  emojiClassName?: string;
}

export default function TeamFlag({
  name,
  code,
  className = 'h-5 w-8',
  imageClassName = 'scale-125',
  emojiClassName = 'text-base',
}: TeamFlagProps) {
  const flagUrl = getFlagUrl(name, code);

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-[3px] border border-white/10 bg-black/30 flex items-center justify-center ${className}`}>
      <span className={`${emojiClassName} leading-none`}>{getFlagEmoji(name, code)}</span>
      {flagUrl && (
        <img
          src={flagUrl}
          className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`}
          alt=""
          loading="lazy"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}
