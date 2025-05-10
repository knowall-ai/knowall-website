"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChatLog {
  id: string;
  timestamp: string;
  userMessage: string;
  assistantResponse: string;
  userIp?: string;
  userAgent?: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  // Function to fetch logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/logs', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Unauthorized: Invalid API key');
          setAuthenticated(false);
        } else {
          setError(`Error: ${response.status} ${response.statusText}`);
        }
        return;
      }
      
      const data = await response.json();
      setLogs(data);
      setAuthenticated(true);
    } catch (err) {
      setError('Failed to fetch logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle authentication
  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Chat Logs Admin</h1>
      
      {!authenticated ? (
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
                  API Key
                </label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  required
                />
              </div>
              <Button type="submit">Authenticate</Button>
              {error && <p className="text-red-500 mt-2">{error}</p>}
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex justify-between items-center">
            <Button onClick={fetchLogs} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh Logs'}
            </Button>
            <Button variant="outline" onClick={() => setAuthenticated(false)}>
              Logout
            </Button>
          </div>
          
          {error && <p className="text-red-500 mb-4">{error}</p>}
          
          {logs.length === 0 ? (
            <p>No chat logs found.</p>
          ) : (
            <div className="space-y-6">
              {logs.map((log) => (
                <Card key={log.id} className="overflow-hidden">
                  <CardHeader className="bg-gray-100">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Log ID: {log.id}</CardTitle>
                      <span className="text-sm text-gray-500">{formatDate(log.timestamp)}</span>
                    </div>
                    {log.userIp && (
                      <p className="text-sm text-gray-500">
                        IP: {log.userIp} | User Agent: {log.userAgent}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h3 className="font-bold mb-2">User Message:</h3>
                      <p className="bg-blue-50 p-3 rounded">{log.userMessage}</p>
                    </div>
                    <div>
                      <h3 className="font-bold mb-2">Assistant Response:</h3>
                      <p className="bg-green-50 p-3 rounded">{log.assistantResponse}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
