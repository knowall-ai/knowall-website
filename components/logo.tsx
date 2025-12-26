import Image from 'next/image';

interface LogoProps {
  className?: string;
  darkBackground?: boolean;
}

export default function Logo({ className = '', darkBackground = false }: LogoProps) {
  return (
    <Image
      src="/images/logo.png"
      alt="KnowAll.ai"
      width={120}
      height={48}
      className={`${className} ${darkBackground ? 'brightness-0 invert' : ''}`}
    />
  );
}
