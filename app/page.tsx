import { Zap, Bot, Code, Github, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import ConversationInterface from "@/components/conversation-interface"
import Header from "@/components/header"
import Footer from "@/components/footer"
import ServiceCard from "@/components/service-card"
import WhatsAppButton from "@/components/whatsapp-button"
import BitcoinLogo from "@/components/bitcoin-logo"
import BackgroundImage from "@/components/background-image"
import AutoGenLogo from "@/components/autogen-logo"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      {/* Hero Section with AI Conversation Interface */}
      <BackgroundImage
        src="/images/green-bg.png"
        className="flex flex-col items-center justify-center px-4 py-20 md:py-32 overflow-hidden"
      >
        <div className="absolute inset-0 bg-black/30"></div>

        <div className="container relative z-10 max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-white">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Knowledge is <span className="text-lime-300">processing power</span>
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-white/90">
                We build intelligent AI systems that transform businesses through custom Microsoft Copilots, multi-agent
                teams, and Bitcoin-powered value exchange networks.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button className="bg-lime-500 text-white hover:bg-lime-600 shadow-lg shadow-lime-500/30">
                  Our Services
                </Button>
                <Button variant="outline" className="border-white text-white hover:bg-white/10">
                  Learn About Zapp.ie
                </Button>
              </div>
            </div>

            <div className="flex-1 w-full max-w-md">
              <ConversationInterface />
            </div>
          </div>
        </div>
      </BackgroundImage>

      {/* Services Section */}
      <section id="services" className="py-20 px-4 bg-gray-900">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white">Our Services</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <ServiceCard
              icon={<Bot className="h-8 w-8 text-lime-500" />}
              title="AI Consultancy"
              description="Expert guidance on implementing AI solutions tailored to your business needs."
              darkMode={true}
              showLearnMore={false}
            />

            <ServiceCard
              icon={<Code className="h-8 w-8 text-lime-500" />}
              title="Microsoft Copilot Development"
              description="Custom Microsoft Copilots built to enhance productivity and automate workflows."
              darkMode={true}
              showLearnMore={false}
            />

            <ServiceCard
              icon={<BitcoinLogo size={32} />}
              title="Value-for-Value Transactions"
              description="Revolutionary peer-to-peer Bitcoin transfers between autonomous AI agents."
              darkMode={true}
              showLearnMore={false}
            />
          </div>
        </div>
      </section>

      {/* About Zapp.ie Section */}
      <section id="zapp" className="py-20 px-4 bg-gray-800 text-white">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            Zapp.ie: Incentivizing teammates, copilots & customers
          </h2>

          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <p className="text-lg text-gray-200 mb-6">
                Zapp.ie is an open-source platform that integrates Microsoft Teams with Bitcoin microtransactions and AI
                agents (Copilots) to enhance collaboration, productivity, and real-value incentives. Built on the
                "value-for-value" model, it transforms the digital workspace by linking communication tools with
                financial rewards and AI-driven support.
              </p>
              <p className="text-lg text-gray-200 mb-6">
                Using seamless Bitcoin microtransactions, Zapp.ie incentivizes engagement across team members, clients,
                and AI agents. This approach fosters a culture of recognition and accountability, where
                contributions—whether human or AI—are rewarded in proportion to the value they deliver.
              </p>
              <p className="text-lg text-gray-200 mb-8">
                With its open-source foundation, Zapp.ie can be tailored to meet the unique needs of any organization.
                By aligning incentives and enabling value exchange across people and intelligent systems, it supports
                more motivated, transparent, and effective collaboration.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://github.com/BenGWeeks/Zapp.ie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gray-950 hover:bg-black text-white px-4 py-2 rounded-md transition-colors"
                >
                  <Github className="h-5 w-5" />
                  <span>GitHub Repository</span>
                </a>
                <div className="flex items-center gap-2 text-orange-500">
                  <BitcoinLogo size={24} />
                  <span className="font-medium">Powered by Bitcoin Lightning</span>
                </div>
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              <Card className="p-0 w-full max-w-md shadow-lg border-0 bg-gray-900 overflow-hidden">
                <img src="/images/zappie.png" alt="Zapp.ie AI Agent" className="w-full h-auto object-cover" />
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Microsoft Copilots Section */}
      <section id="copilots" className="py-20 px-4 bg-gray-900">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">
            Building AI Agents & Microsoft Copilots
          </h2>
          <p className="text-lg text-center text-gray-300 max-w-3xl mx-auto mb-12">
            We specialize in developing custom Microsoft Copilots that transform how businesses operate, orchestrating
            multi-agent teams that work together seamlessly with built-in automations to handle complex tasks and
            enhance human capabilities through AI.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6 shadow-md border-0 bg-gray-800 text-white">
              <div className="mb-6">
                <div className="flex items-center">
                  <img src="/images/microsoft-copilot-logo.png" alt="Microsoft Copilot" className="h-12 w-auto" />
                  <span className="ml-3 text-lg font-medium">Microsoft Copilot</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-4">Custom Copilot Development</h3>
              <p className="text-gray-300 mb-4">
                We build tailored Microsoft Copilots that integrate with your existing systems and workflows, providing
                intelligent assistance and automation. We also leverage the Microsoft Bot Framework to create robust,
                scalable conversational experiences across multiple channels and platforms.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span>Integration with Microsoft 365 and Teams</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span>Custom knowledge bases and data sources</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span>Creating custom automations with Power Automate</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 shadow-md border-0 bg-gray-800 text-white">
              <div className="mb-6">
                <AutoGenLogo darkMode={true} />
              </div>
              <h3 className="text-xl font-semibold mb-4">Multi-Agent Teams with AutoGen</h3>
              <p className="text-gray-300 mb-4">
                We leverage Microsoft AutoGen to build collaborative multi-agent teams that work together to solve
                complex problems, with each agent having specific specializations.
              </p>

              <div className="mb-6 overflow-hidden rounded-lg">
                <img
                  src="/images/multi-agent-medical.png"
                  alt="Multi-Agent System with specialized AI agents"
                  className="w-full h-auto"
                />
              </div>

              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span>Specialized agents with distinct roles and capabilities</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span>Coordinated problem-solving and task execution</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span>Human-in-the-loop collaboration and oversight</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <BackgroundImage src="/images/green-bg.png" className="py-20 px-4 text-white">
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="container max-w-6xl mx-auto relative z-10">
          <div className="bg-gray-900/80 backdrop-blur-sm p-8 md:p-12 rounded-xl max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Get In Touch</h2>
            <p className="text-lg mb-8 text-center">
              Ready to explore how our AI solutions can transform your business? Contact us today.
            </p>

            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Button className="bg-lime-600 text-white hover:bg-lime-700">
                Email Us <MessageSquare className="ml-2 h-4 w-4" />
              </Button>
              <WhatsAppButton darkMode={true} />
            </div>
          </div>
        </div>
      </BackgroundImage>

      <Footer darkMode={true} />
    </main>
  )
}
