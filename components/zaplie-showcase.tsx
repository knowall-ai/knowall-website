import Image from 'next/image';

/**
 * Zaplie product showcase: three landscape app screens fanned like devices on a
 * desk — the feed centred and forward, two more angled behind it. Screens are the
 * real 1440×810 Zaplie captures. The flanking two are decorative (aria-hidden);
 * only the centre screen carries alt text so screen readers aren't read three
 * near-identical descriptions. Pure 2D transforms, so it degrades gracefully and
 * the side screens collapse away on narrow viewports.
 */

const frame = 'overflow-hidden rounded-xl border border-gray-700 bg-gray-950 p-1.5 shadow-2xl';

export default function ZaplieShowcase() {
  return (
    <div className="relative w-full">
      {/* Brand-lime bloom behind the fan */}
      <div
        className="absolute left-1/2 top-1/2 h-[85%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-lime-500/20 blur-3xl"
        aria-hidden="true"
      ></div>

      <div className="relative mx-auto aspect-[3/2] max-w-xl">
        {/* Left screen — angled behind */}
        <div
          aria-hidden="true"
          className={`absolute left-0 top-[16%] hidden w-[62%] -rotate-[10deg] brightness-90 sm:block ${frame} shadow-black/50`}
        >
          <Image
            src="/images/zapp/01-bot.png"
            alt=""
            width={1440}
            height={810}
            className="rounded-lg"
          />
        </div>

        {/* Right screen — angled behind */}
        <div
          aria-hidden="true"
          className={`absolute right-0 top-[16%] hidden w-[62%] rotate-[10deg] brightness-95 sm:block ${frame} shadow-black/50`}
        >
          <Image
            src="/images/zapp/08-wallet.png"
            alt=""
            width={1440}
            height={810}
            className="rounded-lg"
          />
        </div>

        {/* Centre screen — forward */}
        <div
          className={`absolute left-1/2 top-0 w-[80%] -translate-x-1/2 ${frame} shadow-lime-500/20`}
        >
          <Image
            src="/images/zapp/02-feed.png"
            alt="Zaplie feed showing Bitcoin zaps sent between teammates"
            width={1440}
            height={810}
            className="rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
