interface AutoGenLogoProps {
  darkMode?: boolean
}

export default function AutoGenLogo({ darkMode = false }: AutoGenLogoProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-blue-600 text-white font-bold px-2 py-1 rounded">
        Auto<span className="text-blue-200">Gen</span>
      </div>
      <span className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>by Microsoft Research</span>
    </div>
  )
}
