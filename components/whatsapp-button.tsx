"use client"

import { Button } from "@/components/ui/button"
import WhatsAppLogo from "./whatsapp-logo"

interface WhatsAppButtonProps {
  darkMode?: boolean
}

export default function WhatsAppButton({ darkMode = false }: WhatsAppButtonProps) {
  const openWhatsApp = () => {
    // KnowAll.ai WhatsApp number
    const phoneNumber = "447968847178" // +44 7968847178 without the plus sign for WhatsApp API
    const message = "Hello, I'm interested in learning more about KnowAll.ai services."

    // Create WhatsApp URL with pre-filled message
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`

    // Open in new tab
    window.open(whatsappUrl, "_blank")
  }

  return (
    <Button
      onClick={openWhatsApp}
      className={darkMode ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-500 hover:bg-green-600"}
    >
      <WhatsAppLogo className="mr-2 h-4 w-4" />
      WhatsApp
    </Button>
  )
}
