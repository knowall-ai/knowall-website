import type { ReactNode } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"

interface ServiceCardProps {
  icon: ReactNode
  title: string
  description: string
  darkMode?: boolean
  showLearnMore?: boolean
}

export default function ServiceCard({
  icon,
  title,
  description,
  darkMode = false,
  showLearnMore = true,
}: ServiceCardProps) {
  return (
    <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
      <CardContent className="pt-6">
        <div className="mb-4">{icon}</div>
        <h3 className={`text-xl font-semibold mb-2 ${darkMode ? "text-white" : ""}`}>{title}</h3>
        <p className={darkMode ? "text-gray-300" : "text-gray-600"}>{description}</p>
      </CardContent>
      {showLearnMore && (
        <CardFooter className="pt-0">
          <Button
            variant="link"
            className={`p-0 ${darkMode ? "text-lime-500 hover:text-lime-400" : "text-lime-600 hover:text-lime-700"}`}
          >
            Learn more <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
