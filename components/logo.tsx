interface LogoProps {
  className?: string
  darkBackground?: boolean
}

export default function Logo({ className = "", darkBackground = false }: LogoProps) {
  return (
    <img
      src="/images/logo.png"
      alt="KnowAll.ai"
      className={`${className} ${darkBackground ? "brightness-0 invert" : ""}`}
    />
  )
}
