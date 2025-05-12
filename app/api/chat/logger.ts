import fs from 'fs';
import path from 'path';

// Define the log directory and file
const LOG_DIR = path.join(process.cwd(), 'logs');
const CHAT_LOG_FILE = path.join(LOG_DIR, 'chat-logs.json');

// Define the structure of a chat log entry
interface ChatLogEntry {
  id: string;
  timestamp: string;
  userMessage: string;
  assistantResponse: string;
  userIp?: string;
  userAgent?: string;
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

// Log a chat conversation
export async function logChat(
  userMessage: string,
  assistantResponse: string,
  conversationId: string,
  request?: Request
): Promise<boolean> {
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

      // Add the new entry to the logs
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
    
    // Read and return all logs
    const logsRaw = fs.readFileSync(CHAT_LOG_FILE, 'utf-8');
    return JSON.parse(logsRaw);
  } catch (error) {
    console.error('Error reading chat logs:', error);
    return [];
  }
}

// Get a specific chat log by ID
export async function getChatLogById(id: string): Promise<ChatLogEntry | null> {
  try {
    const logs = await getAllChatLogs();
    return logs.find(log => log.id === id) || null;
  } catch (error) {
    console.error('Error getting chat log by ID:', error);
    return null;
  }
}
