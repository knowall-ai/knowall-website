'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const images = [
  {
    src: '/images/zapp/01-bot.png',
    alt: 'Zapp.ie Chat Bot Interface'
  },
  {
    src: '/images/zapp/02-feed.png',
    alt: 'Zapp.ie Activity Feed'
  },
  {
    src: '/images/zapp/03-bounties.png',
    alt: 'Zapp.ie Bounties System'
  },
  {
    src: '/images/zapp/04-raisers.png',
    alt: 'Zapp.ie Group Funding Raisers'
  },
  {
    src: '/images/zapp/05-automations.png',
    alt: 'Zapp.ie Automations Dashboard'
  },
  {
    src: '/images/zapp/06-project.png',
    alt: 'Zapp.ie Project Management'
  },
  {
    src: '/images/zapp/07-rewards.png',
    alt: 'Zapp.ie Rewards Program'
  },
  {
    src: '/images/zapp/08-wallet.png',
    alt: 'Zapp.ie Wallet & Transactions'
  },
  {
    src: '/images/zapp/09-sasha.png',
    alt: 'Zapp.ie User Profile'
  }
]

export default function ZappCarousel() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalImage, setModalImage] = useState(0)
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0)

  const openModal = (index: number) => {
    setModalImage(index)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
  }

  const scrollThumbnailsLeft = () => {
    setThumbnailStartIndex((prev) => Math.max(0, prev - 1))
  }

  const scrollThumbnailsRight = () => {
    setThumbnailStartIndex((prev) => Math.min(images.length - 4, prev + 1))
  }
  
  // Display 4 thumbnails at once
  const visibleThumbnails = images.slice(thumbnailStartIndex, thumbnailStartIndex + 4)
  const showLeftArrow = thumbnailStartIndex > 0
  const showRightArrow = thumbnailStartIndex < images.length - 4

  return (
    <div className="mt-12 mb-8">
      {/* Thumbnails with left/right arrows */}
      <div className="relative px-14">  
        <div className="flex justify-center gap-4 overflow-visible py-4">
          {showLeftArrow && (
            <button 
              onClick={scrollThumbnailsLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full bg-gray-800 p-2 text-white hover:bg-gray-700"
              aria-label="Scroll thumbnails left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          
          {visibleThumbnails.map((image, index) => {
            const actualIndex = index + thumbnailStartIndex
            return (
              <div
                key={actualIndex}
                onClick={() => openModal(actualIndex)}
                onMouseEnter={() => setHoveredIndex(actualIndex)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="relative h-40 w-60 flex-shrink-0 cursor-pointer transition-all transform hover:scale-105"
              >
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {hoveredIndex === actualIndex && (
                    <div className="absolute inset-0 border-2 border-lime-500" />
                  )}
                </div>
                <Image
                  src={image.src}
                  alt={`Thumbnail ${actualIndex + 1}`}
                  width={240}
                  height={160}
                  className="w-full h-full object-cover"
                  quality={90}
                  priority={actualIndex === 0}
                />
              </div>
            )
          })}
          
          {showRightArrow && (
            <button 
              onClick={scrollThumbnailsRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full bg-gray-800 p-2 text-white hover:bg-gray-700"
              aria-label="Scroll thumbnails right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Full-size modal that only appears when an image is clicked */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={closeModal}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeModal}
              className="absolute -right-4 -top-4 z-10 rounded-full bg-gray-900 p-2 text-white hover:bg-gray-800"
              aria-label="Close modal"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setModalImage((prev) => (prev - 1 + images.length) % images.length)
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              
              <Image
                src={images[modalImage].src}
                alt={images[modalImage].alt}
                width={1600}
                height={1000}
                className="max-h-[85vh] w-auto object-contain"
                quality={95}
                priority
              />
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setModalImage((prev) => (prev + 1) % images.length)
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
