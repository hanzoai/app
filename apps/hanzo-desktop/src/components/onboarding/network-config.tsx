import React, { useState } from 'react';
import { Button } from '@hanzo/ui';
import { Input } from '@hanzo/ui';
import { Label } from '@hanzo/ui';
import { RadioGroup, RadioGroupItem } from '@hanzo/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hanzo/ui';
import { AlertCircle, Globe, Lock, Server, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@hanzo/ui';

export type NetworkExposureType = 'none' | 'localxpose' | 'ngrok' | 'public';

interface NetworkConfigProps {
  onComplete: (config: NetworkConfiguration) => void;
  onSkip?: () => void;
}

export interface NetworkConfiguration {
  exposureType: NetworkExposureType;
  apiKey?: string;
  customDomain?: string;
  enableRouter?: boolean;
  walletAddress?: string;
}

export const NetworkConfig: React.FC<NetworkConfigProps> = ({
  onComplete,
  onSkip,
}) => {
  const [exposureType, setExposureType] = useState<NetworkExposureType>('none');
  const [apiKey, setApiKey] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [enableRouter, setEnableRouter] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    const config: NetworkConfiguration = {
      exposureType,
      apiKey:
        exposureType !== 'none' && exposureType !== 'public'
          ? apiKey
          : undefined,
      customDomain: exposureType === 'public' ? customDomain : undefined,
      enableRouter,
      walletAddress: enableRouter ? walletAddress : undefined,
    };
    onComplete(config);
  };

  const isValid = () => {
    if (exposureType === 'none') return true;
    if (exposureType === 'public' && customDomain) return true;
    if ((exposureType === 'localxpose' || exposureType === 'ngrok') && apiKey)
      return true;
    return false;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Network Exposure Configuration
          </CardTitle>
          <CardDescription>
            Choose how your Hanzo node will be accessible on the network
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={exposureType}
            onValueChange={(value) =>
              setExposureType(value as NetworkExposureType)
            }
          >
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start space-x-3">
                <RadioGroupItem value="none" className="mt-1" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Lock className="h-4 w-4" />
                    Local Only (Default)
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Keep your node private and accessible only on your local
                    machine
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start space-x-3">
                <RadioGroupItem value="localxpose" className="mt-1" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Server className="h-4 w-4" />
                    LocalXpose Tunnel
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Expose your node using LocalXpose secure tunneling service
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start space-x-3">
                <RadioGroupItem value="ngrok" className="mt-1" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Server className="h-4 w-4" />
                    Ngrok Tunnel
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Expose your node using Ngrok secure tunneling service
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start space-x-3">
                <RadioGroupItem value="public" className="mt-1" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Globe className="h-4 w-4 text-yellow-500" />
                    Public IP (Advanced)
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Directly expose your node with a public IP or domain
                  </p>
                </div>
              </label>
            </div>
          </RadioGroup>

          {(exposureType === 'localxpose' || exposureType === 'ngrok') && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="apiKey">
                {exposureType === 'localxpose' ? 'LocalXpose' : 'Ngrok'} API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={`Enter your ${exposureType} API key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Get your API key from{' '}
                <a
                  href={
                    exposureType === 'localxpose'
                      ? 'https://localxpose.io'
                      : 'https://ngrok.com'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {exposureType === 'localxpose'
                    ? 'localxpose.io'
                    : 'ngrok.com'}
                </a>
              </p>
            </div>
          )}

          {exposureType === 'public' && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="customDomain">Public Domain or IP</Label>
              <Input
                id="customDomain"
                type="text"
                placeholder="example.com or 192.168.1.100"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
              />
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Make sure your firewall and router are configured to allow
                  incoming connections
                </AlertDescription>
              </Alert>
            </div>
          )}

          {exposureType !== 'none' && (
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full justify-between"
              >
                <span>Advanced Options</span>
                <span>{showAdvanced ? '▼' : '▶'}</span>
              </Button>

              {showAdvanced && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="h-4 w-4" />
                      Earn Tokens & Join Router Network
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableRouter"
                        checked={enableRouter}
                        onChange={(e) => setEnableRouter(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="enableRouter" className="cursor-pointer">
                        Participate as a decentralized router node
                      </Label>
                    </div>

                    {enableRouter && (
                      <>
                        <Alert>
                          <DollarSign className="h-4 w-4" />
                          <AlertDescription>
                            Earn tokens by providing compute and AI services to
                            the network
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-2">
                          <Label htmlFor="walletAddress">
                            Wallet Address (for rewards)
                          </Label>
                          <Input
                            id="walletAddress"
                            type="text"
                            placeholder="0x..."
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                          />
                          <p className="text-muted-foreground text-xs">
                            Ethereum-compatible wallet address where you'll
                            receive token rewards
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {onSkip && (
          <Button variant="outline" onClick={onSkip} className="flex-1">
            Skip for Now
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={!isValid()} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
};
