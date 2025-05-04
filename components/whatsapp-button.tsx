"use client"

import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"

interface WhatsAppButtonProps {
  darkMode?: boolean
}

export default function WhatsAppButton({ darkMode = false }: WhatsAppButtonProps) {
  const openWhatsApp = () => {
    // Replace with your actual WhatsApp number
    const phoneNumber = "1234567890"
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
      <MessageSquare className="mr-2 h-4 w-4" />
      WhatsApp Us
    </Button>
  )
}
