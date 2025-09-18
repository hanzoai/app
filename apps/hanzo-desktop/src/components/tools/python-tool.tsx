import { type PythonHanzoTool } from '@hanzo/message/api/tools/types';

import ToolDetailsCard from './components/tool-details-card';

export default function PythonTool({
  tool,
  isEnabled,
  isPlaygroundTool,
  toolRouterKey,
}: {
  tool: PythonHanzoTool;
  isEnabled: boolean;
  isPlaygroundTool?: boolean;
  toolRouterKey: string;
}) {
  return (
    <ToolDetailsCard
      isEnabled={isEnabled}
      isPlaygroundTool={isPlaygroundTool}
      tool={tool}
      toolKey={toolRouterKey}
      toolType="Python"
    />
  );
}
