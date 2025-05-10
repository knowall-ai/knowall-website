import Image from 'next/image'

interface SallyAvatarProps {
  className?: string
  size?: number
}

export default function SallyAvatar({ className = '', size = 24 }: SallyAvatarProps) {
  return (
    <div 
      className={`relative rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/sally-avatar.png"
        alt="Sally"
        width={size}
        height={size}
        className="object-cover"
        priority
      />
    </div>
  )
}
