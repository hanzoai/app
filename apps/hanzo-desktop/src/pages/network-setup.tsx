import { useNavigate } from 'react-router';
import {
  NetworkConfig,
  type NetworkConfiguration,
} from '@/components/onboarding/network-config';
import { useHanzoNodeSetOptionsMutation } from '@/lib/hanzo-node-manager/hanzo-node-manager-client';
import { toast } from 'sonner';

export default function NetworkSetupPage() {
  const navigate = useNavigate();
  const setNodeOptions = useHanzoNodeSetOptionsMutation();

  const handleNetworkConfig = async (config: NetworkConfiguration) => {
    try {
      // Store network configuration in node options
      await setNodeOptions.mutateAsync({
        network_exposure_type: config.exposureType,
        tunnel_api_key: config.apiKey,
        public_domain: config.customDomain,
        enable_router: config.enableRouter,
        wallet_address: config.walletAddress,
      } as any);

      toast.success('Network configuration saved successfully!');

      // Navigate to the next onboarding step (model selection)
      void navigate('/install-ai-models');
    } catch (error) {
      console.error('Failed to save network configuration:', error);
      toast.error('Failed to save network configuration');
    }
  };

  const handleSkip = () => {
    // Skip network configuration and continue with default (local only)
    void navigate('/install-ai-models');
  };

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Network Setup</h1>
          <p className="text-muted-foreground mt-2">
            Configure how your Hanzo node connects to the network
          </p>
        </div>

        <NetworkConfig onComplete={handleNetworkConfig} onSkip={handleSkip} />
      </div>
    </div>
  );
}
