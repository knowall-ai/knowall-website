"use client"

import type React from "react"
import { useEffect, useState } from "react"

interface BackgroundImageProps {
  src: string
  className?: string
  children: React.ReactNode
}

export default function BackgroundImage({ src, className = "", children }: BackgroundImageProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.src = src
    img.onload = () => setLoaded(true)
  }, [src])

  return (
    <div
      className={`relative ${className} ${!loaded ? "bg-gray-900" : ""}`}
      style={
        loaded
          ? {
              backgroundImage: `url(${src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}
      }
    >
      {children}
    </div>
  )
}
