import { Github } from "lucide-react"
import Logo from "@/components/logo"

interface FooterProps {
  darkMode?: boolean
}

export default function Footer({ darkMode = false }: FooterProps) {
  return (
    <footer className="bg-gray-950 text-white py-12 px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Logo darkBackground={true} className="h-10" />
            </div>
            <p className="text-gray-400">
              AI consultancy specializing in agent development and Bitcoin-powered value-for-value transactions.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Services</h4>
            <ul className="space-y-2">
              <li>
                <a href="#services" className="text-gray-400 hover:text-white transition-colors">
                  AI Consultancy
                </a>
              </li>
              <li>
                <a href="#copilots" className="text-gray-400 hover:text-white transition-colors">
                  Microsoft Copilots
                </a>
              </li>
              <li>
                <a href="#copilots" className="text-gray-400 hover:text-white transition-colors">
                  Multi-Agent Teams
                </a>
              </li>
              <li>
                <a href="#zapp" className="text-gray-400 hover:text-white transition-colors">
                  Bitcoin Integration
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Projects</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/Bengweeks/zapp.ie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  <span>Zapp.ie</span>
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/bengweeks/t-minus-15"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  <span>T-Minus-15</span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <p className="text-gray-400 mb-2">hello@knowall.ai</p>
            <div className="flex gap-4 mt-4">
              <a
                href="https://x.com/KnowAllAI"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a
                href="https://github.com/knowall-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="sr-only">GitHub</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/3593753"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="sr-only">LinkedIn</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="https://primal.net/p/nprofile1qqstwvlv45n9mr0k8c279rfyjus5rf0tcgdlmu2n9tdd9ensr6zn3ys4u7evm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="sr-only">Nostr</span>
                <div className="h-6 w-6 flex items-center justify-center">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 211 197" aria-hidden="true">
                    <path d="M107 69L106 70L105 70L104 70L103 71L102 72L101 73L100 74L100 75L99 76L99 77L99 78L99 79L99 80L99 81L100 82L100 83L101 84L102 85L103 86L104 86L105 87L106 87L107 87L108 87L109 87L110 87L111 87L112 87L113 86L114 85L115 84L116 83L116 82L117 81L117 80L117 79L117 78L117 77L117 76L116 75L116 74L115 73L115 72L114 72L113 71L112 70L111 70L110 70L109 69L108 69ZM105 40L104 41L103 41L102 41L101 41L100 41L99 42L98 42L97 42L96 42L95 43L94 43L93 44L92 44L91 44L90 45L89 45L88 46L87 46L86 47L85 48L84 48L83 49L82 50L81 50L80 50L79 50L78 49L77 48L76 47L76 46L76 45L76 44L75 43L74 42L73 42L72 41L71 41L70 41L69 41L68 41L67 41L66 41L65 41L64 41L63 41L62 41L61 41L60 41L59 41L58 41L57 41L56 41L55 41L54 41L53 41L52 41L51 41L50 41L49 41L48 42L47 42L46 42L45 43L44 44L44 45L44 46L44 47L44 48L44 49L44 50L44 51L44 52L44 53L44 54L44 55L44 56L44 57L44 58L44 59L44 60L44 61L44 62L44 63L44 64L44 65L44 66L44 67L44 68L44 69L44 70L44 71L44 72L44 73L44 74L44 75L44 76L44 77L44 78L44 79L44 80L44 81L44 82L44 83L44 84L44 85L44 86L44 87L44 88L44 89L44 90L44 91L44 92L44 93L44 94L44 95L44 96L44 97L44 98L44 99L44 100L44 101L44 102L44 103L44 104L44 105L44 106L44 107L44 108L44 109L44 110L44 111L44 112L44 113L44 114L44 115L44 116L44 117L44 118L44 119L44 120L44 121L44 122L44 123L44 124L44 125L44 126L44 127L44 128L44 129L44 130L44 131L44 132L44 133L44 134L44 135L44 136L44 137L44 138L44 139L44 140L44 141L44 142L44 143L44 144L44 145L44 146L44 147L44 148L44 149L44 150L44 151L44 152L44 153L44 154L44 155L45 156L46 157L47 158L48 158L49 158L50 158L51 158L52 158L53 158L54 158L55 158L56 158L57 158L58 158L59 158L60 158L61 158L62 158L63 158L64 158L65 158L66 158L67 158L68 158L69 158L70 158L71 158L72 158L73 158L74 158L75 157L76 157L77 156L77 155L77 154L77 153L77 152L77 151L77 150L77 149L77 148L77 147L77 146L77 145L77 144L77 143L77 142L77 141L77 140L77 139L77 138L77 137L77 136L77 135L77 134L77 133L77 132L77 131L76 130L76 129L76 128L76 127L76 126L76 125L76 124L75 123L75 122L75 121L75 120L75 119L75 118L74 117L74 116L74 115L74 114L74 113L74 112L73 111L73 110L73 109L73 108L72 107L72 106L72 105L72 104L71 103L71 102L71 101L71 100L71 99L70 98L70 97L70 96L70 95L69 94L69 93L69 92L69 91L69 90L68 89L68 88L68 87L68 86L68 85L67 84L67 83L67 82L67 81L67 80L67 79L67 78L66 77L66 76L66 75L66 74L66 73L66 72L67 71L67 70L67 69L67 68L68 67L68 66L69 65L70 64L71 63L72 62L73 62L74 61L75 61L76 61L77 60L78 60L79 60L80 60L81 60L82 59L83 59L84 59L85 59L86 59L87 59L88 59L89 59L90 59L91 58L92 58L93 58L94 58L95 58L96 58L97 58L98 58L99 58L100 58L101 58L102 58L103 58L104 59L105 59L106 59L107 59L108 59L109 60L110 60L111 60L112 60L113 61L114 61L115 61L116 62L117 62L118 63L119 64L120 64L121 65L122 66L123 67L123 68L124 69L125 70L125 71L125 72L125 73L126 74L126 75L126 76L126 77L126 78L126 79L127 80L128 81L129 82L130 83L131 83L132 84L133 84L134 84L135 85L136 85L137 85L138 85L139 85L140 85L141 85L142 85L143 85L144 85L145 85L146 85L147 85L148 85L149 85L150 85L151 86L152 86L153 87L154 87L155 88L155 89L155 90L156 91L156 92L156 93L155 94L155 95L154 96L153 97L152 98L151 98L150 99L149 99L148 99L147 100L146 100L145 100L144 100L143 100L142 100L141 100L140 100L139 100L138 100L137 100L136 100L135 100L134 100L133 100L132 100L131 100L130 100L129 100L128 100L127 100L126 100L125 100L124 100L123 100L122 100L121 100L120 100L119 100L118 101L117 101L116 101L115 102L114 102L113 102L112 103L111 104L110 105L109 106L109 107L108 108L108 109L107 110L107 111L107 112L106 113L106 114L106 115L106 116L105 117L105 118L105 119L105 120L105 121L105 122L105 123L104 124L104 125L104 126L104 127L104 128L104 129L104 130L104 131L104 132L104 133L104 134L104 135L103 136L103 137L103 138L103 139L103 140L103 141L103 142L103 143L103 144L103 145L103 146L103 147L103 148L103 149L103 150L103 151L103 152L103 153L103 154L104 155L104 156L105 157L106 157L107 158L108 158L109 158L110 158L111 158L112 158L113 158L114 158L115 158L116 158L117 158L118 158L119 158L120 158L121 158L122 158L123 158L124 158L125 158L126 158L127 158L128 158L129 158L130 158L131 158L132 158L133 158L134 158L135 158L136 158L137 158L138 158L139 158L140 158L141 158L142 158L143 158L144 158L145 158L146 158L147 158L148 158L149 158L150 158L151 158L152 158L153 158L154 158L155 158L156 158L157 158L158 158L159 158L160 157L161 157L162 156L162 155L163 154L163 153L163 152L163 151L163 150L163 149L163 148L163 147L163 146L163 145L163 144L163 143L163 142L163 141L163 140L163 139L163 138L163 137L163 136L163 135L163 134L163 133L163 132L163 131L163 130L163 129L163 128L163 127L163 126L163 125L163 124L163 123L163 122L163 121L163 120L163 119L163 118L163 117L163 116L163 115L163 114L163 113L163 112L163 111L163 110L163 109L163 108L163 107L163 106L163 105L163 104L163 103L163 102L163 101L163 100L163 99L163 98L163 97L163 96L163 95L163 94L163 93L163 92L163 91L163 90L163 89L163 88L163 87L163 86L163 85L162 84L162 83L162 82L162 81L162 80L162 79L162 78L161 77L161 76L161 75L161 74L160 73L160 72L160 71L160 70L159 69L159 68L159 67L158 66L158 65L157 64L157 63L156 62L156 61L155 60L155 59L154 58L153 57L153 56L152 55L151 54L150 53L149 52L148 51L147 50L146 50L145 49L144 48L143 47L142 47L141 46L140 46L139 45L138 45L137 44L136 44L135 43L134 43L133 43L132 42L131 42L130 42L129 41L128 41L127 41L126 41L125 41L124 40L123 40L122 40L121 40L120 40L119 40L118 40L117 40L116 40L115 40L114 40L113 40L112 40L111 40L110 40L109 40L108 40L107 40L106 40Z" />
                  </svg>
                </div>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-400">
          <p>&copy; KnowAll AI Ltd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
