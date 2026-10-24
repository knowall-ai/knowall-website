import fs from 'fs';
import path from 'path';
import { after } from 'next/server';
import { type ChatTurn, trackChatTurn } from '@/lib/analytics/track';

// Define the log directory and file
const LOG_DIR = path.join(process.cwd(), 'logs');
const CHAT_LOG_FILE = path.join(LOG_DIR, 'chat-logs.json');

// Define the structure of a chat log entry
interface ChatLogEntry {
  id: string;
  timestamp: string;
  userMessage: string;
  assistantResponse: string;
  /** Which opening line the conversation started with (for learning what works). */
  greetingId?: string;
  /** Set when Sallie signed off because a limit was hit; the visitor was invited to email. */
  ended?: true;
  endedReason?: 'conversation' | 'ip' | 'day';
  userIp?: string;
  userAgent?: string;
}

/** Chat log entries older than this are pruned (the privacy policy says 30 days). */
export const LOG_RETENTION_DAYS = 30;

/** Entries younger than the retention period (entries without a valid time are dropped). */
export function withinRetention<T extends { timestamp: string }>(logs: T[], now = Date.now()): T[] {
  const cutoff = now - LOG_RETENTION_DAYS * 86_400_000;
  return logs.filter((l) => Date.parse(l.timestamp) >= cutoff);
}

/**
 * Runs analytics after the response when called in a request (Next's after()),
 * otherwise straight away without waiting. Never throws.
 */
function inBackground(task: () => Promise<unknown>) {
  const run = () => task().catch(() => {});
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests): fire and forget
    void run();
  }
}

// Initialize the log directory and file if they don't exist
function initializeLogFile() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    if (!fs.existsSync(CHAT_LOG_FILE)) {
      fs.writeFileSync(CHAT_LOG_FILE, JSON.stringify([], null, 2));
    }
    return true;
  } catch (error) {
    console.error('Failed to initialize log file:', error);
    return false;
  }
}

export interface ChatLogMeta {
  greetingId?: string;
  endedReason?: 'conversation' | 'ip' | 'day';
  /** For the App Insights event: the page's Sallie context, path and turn number */
  context?: string;
  page?: string;
  turn?: number;
  outcome?: ChatTurn['outcome'];
}

// Log a chat conversation
export async function logChat(
  userMessage: string,
  assistantResponse: string,
  conversationId: string,
  request?: Request,
  meta: ChatLogMeta = {}
): Promise<boolean> {
  // Also one App Insights event per turn, for the sales portal's Website page.
  // Off the reply's critical path; the file log below is kept as it was.
  inBackground(() =>
    trackChatTurn(request, {
      conversationId,
      userMessage,
      reply: assistantResponse,
      greetingId: meta.greetingId,
      context: meta.context,
      page: meta.page,
      turn: meta.turn,
      outcome: meta.outcome ?? (meta.endedReason ? 'ended' : 'ok'),
      endedReason: meta.endedReason,
    })
  );
  try {
    // Initialize log file if it doesn't exist
    const initialized = initializeLogFile();
    if (!initialized) {
      console.warn('Skipping chat logging due to initialization failure');
      return false;
    }

    // Create a new log entry
    const newEntry: ChatLogEntry = {
      id: conversationId || Date.now().toString(),
      timestamp: new Date().toISOString(),
      userMessage,
      assistantResponse,
      ...(meta.greetingId ? { greetingId: meta.greetingId } : {}),
      ...(meta.endedReason ? { ended: true as const, endedReason: meta.endedReason } : {}),
    };

    // Add request metadata if available
    if (request) {
      try {
        newEntry.userIp = request.headers.get('x-forwarded-for') || 'unknown';
        newEntry.userAgent = request.headers.get('user-agent') || 'unknown';
      } catch (error) {
        console.error('Error extracting request metadata:', error);
      }
    }

    try {
      // Read existing logs safely
      let logs: ChatLogEntry[] = [];
      try {
        if (fs.existsSync(CHAT_LOG_FILE)) {
          const logsRaw = fs.readFileSync(CHAT_LOG_FILE, 'utf-8');
          logs = JSON.parse(logsRaw);
        } else {
          // If file doesn't exist despite initialization, create an empty array
          logs = [];
        }
      } catch (readError) {
        console.error('Error reading logs, starting with empty log:', readError);
        logs = [];
      }

      // Add the new entry, dropping entries past the retention period
      logs = withinRetention(logs);
      logs.push(newEntry);

      // Write the updated logs back to the file
      fs.writeFileSync(CHAT_LOG_FILE, JSON.stringify(logs, null, 2));

      console.log(`Chat log saved with ID: ${newEntry.id}`);
      return true;
    } catch (writeError) {
      console.error('Error writing chat log:', writeError);
      return false;
    }
  } catch (error) {
    console.error('Error logging chat:', error);
    return false;
  }
}

// Get all chat logs
export async function getAllChatLogs(): Promise<ChatLogEntry[]> {
  try {
    // Initialize log file if it doesn't exist
    initializeLogFile();

    // Read and return the logs within the retention period, pruning the file if any aged out
    const logs: ChatLogEntry[] = JSON.parse(fs.readFileSync(CHAT_LOG_FILE, 'utf-8'));
    const kept = withinRetention(logs);
    if (kept.length < logs.length) fs.writeFileSync(CHAT_LOG_FILE, JSON.stringify(kept, null, 2));
    return kept;
  } catch (error) {
    console.error('Error reading chat logs:', error);
    return [];
  }
}

// Get a specific chat log by ID
export async function getChatLogById(id: string): Promise<ChatLogEntry | null> {
  try {
    const logs = await getAllChatLogs();
    return logs.find((log) => log.id === id) || null;
  } catch (error) {
    console.error('Error getting chat log by ID:', error);
    return null;
  }
}
