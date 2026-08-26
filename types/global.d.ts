interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
  /** WebLN provider injected by Lightning wallet extensions (e.g. Alby). */
  webln?: WebLNProvider;
}

declare var SpeechRecognition: any;

/**
 * Minimal WebLN surface used by the story zap dialog and the shop checkout
 * (enable + pay an invoice, which resolves with the payment preimage).
 */
interface WebLNProvider {
  /** Some providers don't implement enable() — treat it as optional. */
  enable?: () => Promise<unknown>;
  /** Some implementations resolve without a preimage. */
  sendPayment: (invoice: string) => Promise<{ preimage?: string } | undefined>;
}
