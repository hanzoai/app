import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@hanzo/ui';
import { cn } from '@hanzo/ui/utils';
import { RefreshCw, Check, X, AlertCircle } from 'lucide-react';

interface NodeStatus {
  isRunning: boolean;
  address: string;
  error?: string;
}

export function NodeSelector({
  onNodeReady,
  className
}: {
  onNodeReady?: (address: string) => void;
  className?: string;
}) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>({
    isRunning: false,
    address: 'http://127.0.0.1:3690'
  });
  const [checking, setChecking] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  // Check node status
  const checkNode = async () => {
    setChecking(true);
    try {
      // Try to check if node is running via health check
      const response = await fetch(`${nodeStatus.address}/v2/health_check`);
      const isHealthy = response.ok;

      setNodeStatus(prev => ({
        ...prev,
        isRunning: isHealthy,
        error: isHealthy ? undefined : 'Node not responding'
      }));

      if (isHealthy) {
        setAutoDetected(true);
        onNodeReady?.(nodeStatus.address);
      }
    } catch (error) {
      setNodeStatus(prev => ({
        ...prev,
        isRunning: false,
        error: 'Cannot connect to node'
      }));
    } finally {
      setChecking(false);
    }
  };

  // Auto-detect on mount
  useEffect(() => {
    checkNode();
    // Check every 5 seconds
    const interval = setInterval(checkNode, 5000);
    return () => clearInterval(interval);
  }, []);

  const startNode = async () => {
    setChecking(true);
    try {
      await invoke('hanzod_spawn');
      // Wait a bit for node to start
      setTimeout(() => checkNode(), 2000);
    } catch (error) {
      console.error('Failed to start node:', error);
      setNodeStatus(prev => ({
        ...prev,
        error: 'Failed to start node'
      }));
      setChecking(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Node Status Card */}
      <div className="bg-bg-secondary rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Hanzo Node Status</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={checkNode}
            disabled={checking}
            className="h-7 px-2"
          >
            <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className={cn(
            "h-2 w-2 rounded-full",
            nodeStatus.isRunning ? "bg-green-500" : "bg-red-500"
          )} />
          <span className="text-xs text-text-secondary">
            {checking ? 'Checking...' :
             nodeStatus.isRunning ? 'Connected' : 'Not Connected'}
          </span>
          {autoDetected && (
            <span className="text-xs text-cyan-400">(Auto-detected)</span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Address:</span>
            <span className="font-mono">{nodeStatus.address}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Port:</span>
            <span className="font-mono">3690</span>
          </div>

          {nodeStatus.error && (
            <div className="flex items-start gap-2 text-xs text-orange-400">
              <AlertCircle className="h-3 w-3 mt-0.5" />
              <span>{nodeStatus.error}</span>
            </div>
          )}
        </div>

        {!nodeStatus.isRunning && (
          <Button
            size="sm"
            variant="outline"
            onClick={startNode}
            disabled={checking}
            className="w-full h-8"
          >
            {checking ? 'Starting...' : 'Start Local Node'}
          </Button>
        )}
      </div>

      {/* Node Options */}
      <div className="text-xs text-text-secondary space-y-1">
        <p>The Hanzo Node runs locally on your device</p>
        <p>It manages AI models and connects to the Hanzo network</p>
      </div>
    </div>
  );
}