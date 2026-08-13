import Image from 'next/image';

interface SallieAvatarProps {
  className?: string;
  size?: number;
}

export default function SallieAvatar({ className = '', size = 24 }: SallieAvatarProps) {
  return (
    <div
      className={`relative rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/sallie-avatar.png"
        alt="Sallie"
        width={size}
        height={size}
        className="object-cover"
        priority
      />
    </div>
  );
}
