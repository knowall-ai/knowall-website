import Image from 'next/image';
import {
  Zap,
  Bot,
  Code,
  Github,
  Ticket,
  Mail,
  ShieldCheck,
  ExternalLink,
  Clock,
  RefreshCw,
  Smartphone,
  BookOpen,
  ListChecks,
  Users,
} from 'lucide-react';
import EmailIcon from '@/components/email-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ConversationInterface from '@/components/conversation-interface';
import Header from '@/components/header';
import Footer from '@/components/footer';
import ServiceCard from '@/components/service-card';
import WhatsAppButton from '@/components/whatsapp-button';
import NostrButton from '@/components/nostr-button';
import BitcoinLogo from '@/components/bitcoin-logo';
import BackgroundImage from '@/components/background-image';
import AutoGenLogo from '@/components/autogen-logo';
import ZappCarousel from '@/components/zapp-carousel';
import TMinus15Book from '@/components/tminus15-book';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      {/* Hero Section with AI Conversation Interface */}
      <BackgroundImage
        src="/images/green-bg.png"
        className="flex flex-col items-center justify-center px-4 py-10 md:py-16 overflow-hidden"
      >
        <div
          className="absolute inset-x-0 top-0 bottom-0 bg-black/30"
          style={{ height: 'auto' }}
        ></div>

        <div className="container relative z-10 max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-white">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Intelligence is <span className="text-lime-300">processing power</span>
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-white/90">
                We build intelligent AI systems that transform businesses through custom Microsoft
                Copilots, multi-agent teams, and integrating incentivizing best practices through
                value-for-value micro-Bitcoin transactions between people, customers, and AI agents
                <span> using Zaplie</span>.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  className="bg-lime-500 text-white hover:bg-lime-600 shadow-lg shadow-lime-500/30"
                  asChild
                >
                  <a href="#services">Our Services</a>
                </Button>
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  asChild
                >
                  <a href="#zapp">Find out more about Zaplie</a>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white">
            Our Services
          </h2>

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

      {/* About Zaplie Section */}
      <section id="zapp" className="py-20 px-4 bg-gray-800 text-white">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            Zaplie: Incentivizing teammates, copilots & customers
          </h2>

          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <p className="text-lg text-gray-200 mb-6">
                Zaplie is an open-source platform that integrates Microsoft Teams with Bitcoin
                microtransactions and AI agents (Copilots) to enhance collaboration, productivity,
                and real-value incentives. Built on the &quot;value-for-value&quot; model, it
                transforms the digital workspace by linking communication tools with financial
                rewards and AI-driven support.
              </p>
              <p className="text-lg text-gray-200 mb-6">
                Using seamless Bitcoin microtransactions, Zaplie incentivizes engagement across team
                members, clients, and AI agents. This approach fosters a culture of recognition and
                accountability, where contributions—whether human or AI—are rewarded in proportion
                to the value they deliver.
              </p>
              <p className="text-lg text-gray-200 mb-8">
                With its open-source foundation, Zaplie can be tailored to meet the unique needs of
                any organization. By aligning incentives and enabling value exchange across people
                and intelligent systems, it supports more motivated, transparent, and effective
                collaboration.
              </p>
            </div>

            <div className="flex-1 w-full flex flex-col items-center">
              <div className="relative w-full">
                <div
                  className="absolute -inset-4 bg-lime-500/10 blur-2xl rounded-3xl"
                  aria-hidden="true"
                ></div>
                <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-gray-950 shadow-2xl shadow-lime-500/20">
                  {/* Browser chrome bar */}
                  <div
                    className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700"
                    aria-hidden="true"
                  >
                    <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
                    <span className="h-3 w-3 rounded-full bg-yellow-500/80"></span>
                    <span className="h-3 w-3 rounded-full bg-green-500/80"></span>
                    <span className="ml-3 text-xs text-gray-400 bg-gray-900 rounded-md px-3 py-1">
                      www.getzapl.ie
                    </span>
                  </div>
                  <Image
                    src="/images/zapp/02-feed.png"
                    alt="Zaplie feed in Microsoft Teams showing zaps sent between teammates"
                    width={1200}
                    height={675}
                    className="w-full h-auto"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                <a
                  href="https://www.getzapl.ie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-lime-600 hover:bg-lime-700 text-white px-4 py-2 rounded-md transition-colors font-medium"
                >
                  <Zap className="h-5 w-5" />
                  <span>Visit getzapl.ie</span>
                </a>
                <a
                  href="https://github.com/knowall-ai/zaplie-webapp"
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
          </div>

          {/* Zaplie Screenshots Carousel */}
          <ZappCarousel />
        </div>
      </section>

      {/* Zapdesk Section */}
      <section id="zapdesk" className="py-20 px-4 bg-gray-900 text-white">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            Zapdesk: Azure DevOps powered support ticketing
          </h2>

          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Product screenshot (image left, mirroring the Zaplie section's image-right) */}
            <div className="flex-1 w-full">
              <div className="relative">
                <div
                  className="absolute -inset-4 bg-lime-500/10 blur-2xl rounded-3xl"
                  aria-hidden="true"
                ></div>
                <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-gray-950 shadow-2xl shadow-lime-500/20">
                  {/* Browser chrome bar */}
                  <div
                    className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700"
                    aria-hidden="true"
                  >
                    <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
                    <span className="h-3 w-3 rounded-full bg-yellow-500/80"></span>
                    <span className="h-3 w-3 rounded-full bg-green-500/80"></span>
                    <span className="ml-3 text-xs text-gray-400 bg-gray-900 rounded-md px-3 py-1">
                      zapdesk.knowall.ai
                    </span>
                  </div>
                  <Image
                    src="/images/products/zapdesk.png"
                    alt="Zapdesk support ticketing portal homepage"
                    width={1200}
                    height={750}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-lg text-gray-300 mb-8">
                Zapdesk is a Zendesk-style support ticketing portal that uses Azure DevOps as its
                backend, so your support tickets live alongside your engineering work items. It
                pairs a familiar helpdesk interface with Bitcoin Lightning tipping, letting
                customers reward support agents directly for great service.
              </p>

              <ul className="space-y-5 mb-10">
                <li className="flex items-start gap-3">
                  <Ticket className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Azure DevOps work items tagged as &quot;ticket&quot; appear as support tickets,
                    with permission-based, multi-tenant access
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Email-to-ticket creation and replies to requesters via Exchange Online
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Microsoft authentication — sign in with Azure AD/Microsoft accounts
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <BitcoinLogo size={24} />
                  <span className="text-gray-200">
                    Tip support agents with Bitcoin Lightning via QR (LNURL-pay) or Nostr Wallet
                    Connect
                  </span>
                </li>
              </ul>

              <a
                href="https://zapdesk.knowall.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-lime-600 hover:bg-lime-700 text-white px-6 py-3 rounded-md transition-colors font-medium shadow-lg shadow-lime-500/20"
              >
                <ExternalLink className="h-5 w-5" />
                <span>Visit zapdesk.knowall.ai</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Thyme Section */}
      <section id="thyme" className="py-20 px-4 bg-gray-800 text-white">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            Thyme: Time tracking for Business Central
          </h2>

          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <p className="text-lg text-gray-200 mb-8">
                Thyme is a modern time tracking web application that integrates with Microsoft
                Dynamics 365 Business Central. Track your week in an intuitive timesheet grid and
                let Thyme keep your Business Central Jobs and Job Journal Lines in sync
                automatically.
              </p>

              <ul className="space-y-5 mb-10">
                <li className="flex items-start gap-3">
                  <Clock className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Weekly timesheet grid with a real-time start/stop timer for accurate tracking
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <RefreshCw className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Automatic synchronization with Business Central Jobs and Job Journal Lines
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Secure single sign-on via Microsoft Entra ID
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Smartphone className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Modern dark theme that works on desktop and mobile
                  </span>
                </li>
              </ul>

              <a
                href="https://getthyme.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-lime-600 hover:bg-lime-700 text-white px-6 py-3 rounded-md transition-colors font-medium shadow-lg shadow-lime-500/20"
              >
                <ExternalLink className="h-5 w-5" />
                <span>Visit getthyme.ai</span>
              </a>
            </div>

            {/* Product screenshot (image right, mirroring the Zapdesk section's image-left) */}
            <div className="flex-1 w-full">
              <div className="relative">
                <div
                  className="absolute -inset-4 bg-lime-500/10 blur-2xl rounded-3xl"
                  aria-hidden="true"
                ></div>
                <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-gray-950 shadow-2xl shadow-lime-500/20">
                  {/* Browser chrome bar */}
                  <div
                    className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700"
                    aria-hidden="true"
                  >
                    <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
                    <span className="h-3 w-3 rounded-full bg-yellow-500/80"></span>
                    <span className="h-3 w-3 rounded-full bg-green-500/80"></span>
                    <span className="ml-3 text-xs text-gray-400 bg-gray-900 rounded-md px-3 py-1">
                      getthyme.ai
                    </span>
                  </div>
                  <Image
                    src="/images/products/thyme-homepage.png"
                    alt="Thyme time tracking home screen at getthyme.ai"
                    width={1200}
                    height={750}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* T-Minus-15 Section */}
      <section id="tminus15" className="py-20 px-4 bg-gray-900 text-white">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            T-Minus-15: Secrets of an Elite DevOps Team
          </h2>

          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Book (image left, mirroring the Thyme section's image-right) */}
            <div className="flex-1 w-full flex justify-center">
              <TMinus15Book />
            </div>

            <div className="flex-1">
              <p className="text-lg text-gray-300 mb-8">
                T-Minus-15 is our open-source delivery methodology — the in-the-trenches playbook
                behind how KnowAll implements projects. It distils Agile (Scrum) and DevOps
                principles into fifteen concrete steps for taking ideas from backlog to production,
                delivering high-value features to the business 15 days (or less) at a time. And
                it&apos;s not just for people: the same playbook configures the AI agents that work
                alongside our team.
              </p>

              <ul className="space-y-5 mb-10">
                <li className="flex items-start gap-3">
                  <ListChecks className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Fifteen practical steps covering the full delivery lifecycle: Prep, Design,
                    Engineer, Test and Operate
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Cross-functional squad roles — Prepper, Designer, Engineer, Test Pilot and
                    Planner — with short sprints, daily 15-minute stand-ups and retrospectives
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Bot className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    One shared playbook for human team members AND AI agents — persona configs like
                    Poppy the Planner, Pepper the Prepper and Teddy the Tester let AI co-pilots
                    follow the same process as the humans they work with
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Github className="h-6 w-6 text-lime-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-200">
                    Open source under Creative Commons — the specifics teams actually need: roles,
                    estimates, meetings and work-item metadata
                  </span>
                </li>
              </ul>

              <div className="flex flex-wrap gap-4">
                <a
                  href="https://github.com/T-Minus-15/book"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-lime-600 hover:bg-lime-700 text-white px-6 py-3 rounded-md transition-colors font-medium shadow-lg shadow-lime-500/20"
                >
                  <BookOpen className="h-5 w-5" />
                  <span>Read the book</span>
                </a>
                <a
                  href="https://github.com/T-Minus-15"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gray-950 hover:bg-black text-white px-6 py-3 rounded-md transition-colors"
                >
                  <Github className="h-5 w-5" />
                  <span>T-Minus-15 on GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Microsoft Copilots Section */}
      <section id="copilots" className="py-20 px-4 bg-gray-800">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">
            Building AI Agents & Microsoft Copilots
          </h2>
          <p className="text-lg text-center text-gray-300 max-w-3xl mx-auto mb-12">
            We specialize in developing custom Microsoft Copilots that transform how businesses
            operate, orchestrating multi-agent teams that work together seamlessly with built-in
            automations to handle complex tasks and enhance human capabilities through AI.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6 shadow-md border-0 bg-gray-900 text-white">
              <div className="mb-6">
                <div className="flex items-center">
                  <Image
                    src="/images/microsoft-copilot-logo.png"
                    alt="Microsoft Copilot"
                    width={48}
                    height={48}
                    className="h-12 w-auto"
                  />
                  <span className="ml-3 text-lg font-medium">Microsoft Copilot</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-4">Custom Copilot Development</h3>
              <p className="text-gray-300 mb-4">
                We build tailored Microsoft Copilots that integrate with your existing systems and
                workflows, providing intelligent assistance and automation. We also leverage the
                Microsoft Bot Framework to create robust, scalable conversational experiences across
                multiple channels and platforms.
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
              <p className="text-gray-300 mb-4">
                As part of our comprehensive solutions, we also utilize the full Microsoft Power
                Platform suite, including Power Apps for custom application development, Power
                Automate flows for streamlined process automation, Power Pages for secure
                customer-facing portals, and Power BI for insightful data visualization and
                analytics. This integrated approach ensures seamless connectivity between your AI
                solutions and business processes.
              </p>
            </Card>

            <Card className="p-6 shadow-md border-0 bg-gray-900 text-white">
              <div className="mb-6">
                <AutoGenLogo darkMode={true} />
              </div>
              <h3 className="text-xl font-semibold mb-4">Multi-Agent Teams with AutoGen</h3>
              <p className="text-gray-300 mb-4">
                We leverage Microsoft AutoGen to build collaborative multi-agent teams that work
                together to solve complex problems, with each agent having specific specializations.
              </p>

              <div className="mb-6 overflow-hidden rounded-lg">
                <Image
                  src="/images/multi-agent-medical.png"
                  alt="Multi-Agent System with specialized AI agents"
                  width={600}
                  height={400}
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
      <section id="contact">
        <BackgroundImage src="/images/green-bg.png" className="py-20 px-4 text-white">
          <div className="absolute inset-0 bg-black/30"></div>
          <div className="container max-w-6xl mx-auto relative z-10">
            <div className="bg-gray-900/80 backdrop-blur-sm p-8 md:p-12 rounded-xl max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Get In Touch</h2>
              <p className="text-lg mb-8 text-center">
                Ready to explore how our AI solutions can transform your business? Contact us today.
              </p>

              <div className="flex flex-col md:flex-row gap-4 justify-center">
                <Button className="bg-lime-600 text-white hover:bg-lime-700" asChild>
                  <a href="mailto:info@knowall.ai">
                    Email <EmailIcon className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <WhatsAppButton darkMode={true} />
                <NostrButton darkMode={true} />
              </div>
            </div>
          </div>
        </BackgroundImage>
      </section>

      <Footer darkMode={true} />
    </main>
  );
}
