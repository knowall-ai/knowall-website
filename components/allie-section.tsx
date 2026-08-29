import { Bot, Send, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * "Allie for Accounts" homepage section — our AI accounts copilot, presented
 * alongside Sallie for Sales. Kept in its own component (like TeamSection and
 * AgentsSection) rather than inline in app/page.tsx, so the homepage stays a
 * composition of sections and this branch stops re-conflicting with it.
 */
export default function AllieSection() {
  return (
    <section id="allie" className="py-20 px-4 bg-gray-800 text-white">
      <div className="container max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">Allie for Accounts</h2>
        <p className="text-lg text-center text-gray-300 max-w-3xl mx-auto mb-12">
          Meet Allie, our AI accounts copilot. She lives in Microsoft Teams and looks after the
          day-to-day of your accounts department — raising quotes and invoices, chasing payments,
          and reconciling the books — while keeping you in the loop for the decisions that matter.
        </p>

        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-[1.4]">
            <p className="text-lg text-gray-200 mb-6">
              Allie processes incoming invoices automatically, recognising suppliers, amounts, and
              purchase orders. When something doesn&apos;t look right, she doesn&apos;t guess — she
              messages you in Teams and asks. A live feed shows every invoice as it arrives, and her
              reports track the money, time, and carbon saved.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                <span>Quotes and invoices raised and tracked in Xero</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                <span>Integration with Microsoft Dynamics 365 Business Central</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                <span>Automated invoice recognition, payment chasing and reconciliation</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-5 w-5 text-lime-500 mt-0.5 flex-shrink-0" />
                <span>Human-in-the-loop: Allie asks in Teams before making judgement calls</span>
              </li>
            </ul>
            <p className="text-lg text-gray-200">
              Allie builds on the accounts-payable and invoice automation we&apos;ve delivered in
              production, packaged as a copilot your whole finance team can talk to.
            </p>
          </div>

          <div className="flex-1 w-full lg:max-w-none max-w-md flex flex-col justify-center gap-6 self-stretch">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Allie in action</h3>
              <p className="text-sm text-gray-400 mt-1">
                A real exchange from Microsoft Teams &mdash; invoice queried, answered and logged
              </p>
            </div>
            <p className="sr-only">
              Illustration of a Microsoft Teams chat where Allie asks for help with an unrecognised
              Contoso invoice, Ben supplies the missing VAT number, and Allie logs the invoice to
              accounts.
            </p>
            <Card
              aria-hidden="true"
              className="w-full border-0 bg-gray-950 text-white shadow-lg overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-500/20">
                  <Bot className="h-5 w-5 text-lime-500" />
                </div>
                <span className="font-semibold">Allie for Accounts</span>
                <div className="ml-auto flex items-center gap-4 text-sm text-gray-400">
                  <span className="text-white border-b-2 border-lime-500 pb-0.5">Chat</span>
                  <span>Feed</span>
                  <span>Reports</span>
                  <span>Profile</span>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-500/20">
                    <Bot className="h-4 w-4 text-lime-500" />
                  </div>
                  <div className="flex-1 bg-gray-900 rounded-lg p-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold text-lime-400">
                        Allie for Accounts
                      </span>
                      <span className="text-xs text-gray-500">5/12, 9:15 AM</span>
                    </div>
                    <p className="text-sm text-gray-200 mb-3">
                      Hi Ben, I wasn&apos;t able to process an invoice from Contoso. Would you mind
                      assisting me with it?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs border border-gray-700 rounded px-3 py-1 text-gray-300">
                        Yes
                      </span>
                      <span className="text-xs border border-gray-700 rounded px-3 py-1 text-gray-300">
                        No
                      </span>
                      <span className="text-xs border border-gray-700 rounded px-3 py-1 text-gray-300">
                        Ask me again tomorrow
                      </span>
                      <span className="text-xs border border-gray-700 rounded px-3 py-1 text-gray-300">
                        Ask me again in 3 business days
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start justify-end gap-2">
                  <div className="bg-gray-900 rounded-lg px-4 py-2">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-sm font-semibold">Ben Weeks</span>
                      <span className="text-xs text-gray-500">5/12, 9:16 AM</span>
                    </div>
                    <p className="text-sm text-gray-200">Yes</p>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-900/60 text-xs font-semibold text-lime-300">
                    BW
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-500/20">
                    <Bot className="h-4 w-4 text-lime-500" />
                  </div>
                  <div className="flex-1 bg-gray-900 rounded-lg p-4 border-t-2 border-lime-500">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-sm font-semibold text-lime-400">
                        Allie for Accounts
                      </span>
                      <span className="text-xs text-gray-500">5/12, 9:17 AM</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">Invoice # INV-3453211</span>
                      <span className="text-xs text-lime-400 border border-lime-500/40 rounded px-2 py-0.5">
                        Recognised
                      </span>
                    </div>
                    <dl className="space-y-2 text-sm mb-3">
                      <div className="flex gap-2">
                        <dt className="text-gray-400">From:</dt>
                        <dd className="font-medium text-gray-200">Contoso</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-gray-400">Invoice date:</dt>
                        <dd className="font-medium text-gray-200">14/10/2024</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-gray-400 mb-1">VAT number*:</p>
                    <div className="rounded border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-gray-500 mb-3">
                      Please, enter VAT number
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs border border-gray-600 rounded px-3 py-1 text-gray-200">
                        Open invoice
                      </span>
                      <span className="text-xs border border-gray-600 rounded px-3 py-1 text-gray-200">
                        Submit
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-500/20">
                    <Bot className="h-4 w-4 text-lime-500" />
                  </div>
                  <div className="flex-1 bg-gray-900 rounded-lg p-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold text-lime-400">
                        Allie for Accounts
                      </span>
                      <span className="text-xs text-gray-500">5/12, 9:18 AM</span>
                    </div>
                    <p className="text-sm text-gray-200">
                      Thanks, I have now logged this invoice to accounts.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5">
                  <span className="flex-1 text-sm text-gray-500">Type a new message</span>
                  <Send className="h-4 w-4 text-gray-500" />
                </div>
              </div>
            </Card>
            <div className="text-center">
              <Button
                className="bg-lime-500 text-white hover:bg-lime-600 shadow-lg shadow-lime-500/30"
                asChild
              >
                <a href="#contact">Book an Allie demo</a>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
          <div className="bg-gray-900 rounded-lg p-6">
            <p className="text-sm font-semibold mb-2">Invoices processed</p>
            <p className="text-3xl font-bold">
              782 <span className="text-sm font-normal text-gray-400">invoices</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              in the last 7 days <span className="text-lime-400">108 ↑</span>
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-6">
            <p className="text-sm font-semibold mb-2">Money saved</p>
            <p className="text-3xl font-bold">€12,300</p>
            <p className="text-sm text-gray-400 mt-1">
              in the last 7 days <span className="text-lime-400">€4,220 ↑</span>
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-6">
            <p className="text-sm font-semibold mb-2">Time saved</p>
            <p className="text-3xl font-bold">
              34 <span className="text-sm font-normal text-gray-400">hours</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              in the last 7 days <span className="text-lime-400">12 ↑</span>
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-6">
            <p className="text-sm font-semibold mb-2">CO₂ saved</p>
            <p className="text-3xl font-bold">
              34 <span className="text-sm font-normal text-gray-400">tons of carbon</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              in the last 7 days <span className="text-lime-400">12 ↑</span>
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center mt-4">
          Illustrative figures from a typical Allie deployment.
        </p>
      </div>
    </section>
  );
}
