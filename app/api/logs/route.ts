import { NextRequest, NextResponse } from 'next/server';
import { getAllChatLogs, getChatLogById } from '../chat/logger';

// Configure for API route
export const runtime = "nodejs";
// Changed from 'error' to 'force-dynamic' to allow header access
export const dynamic = 'force-dynamic';
export const dynamicParams = false;
export const revalidate = false;

// Get API key from environment variables
// Fallback to a default key only for development
const API_KEY = process.env.ADMIN_API_KEY || 'kna_9f2e8b7c1d3a5f6e0d2c4b6a8e0d2c4b6a8e0d2c4b6a8e0d2c4b6a8e0d2c4b6';

// Log a warning if using the default key
if (!process.env.ADMIN_API_KEY) {
  console.warn('WARNING: Using default admin API key. Set ADMIN_API_KEY in your .env.local file for better security.');
}

// Verify API key from request headers
function verifyApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === API_KEY;
}

// GET handler for retrieving all logs or a specific log
export async function GET(request: NextRequest) {
  try {
    // Verify API key
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing API key' },
        { status: 401 }
      );
    }
    
    // Check if a specific log ID is requested
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (id) {
      // Get a specific log by ID
      const log = await getChatLogById(id);
      
      if (!log) {
        return NextResponse.json(
          { error: 'Log not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(log);
    } else {
      // Get all logs
      const logs = await getAllChatLogs();
      return NextResponse.json(logs);
    }
  } catch (error) {
    console.error('Error retrieving logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
