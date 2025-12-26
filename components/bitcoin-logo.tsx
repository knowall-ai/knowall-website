import Image from 'next/image';

interface BitcoinLogoProps {
  className?: string;
  size?: number;
}

export default function BitcoinLogo({ className = '', size = 24 }: BitcoinLogoProps) {
  return (
    <Image
      src="/images/bitcoin-logo.png"
      alt="Bitcoin"
      className={className}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
