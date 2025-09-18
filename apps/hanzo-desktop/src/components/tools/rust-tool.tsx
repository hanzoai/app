import { type RustHanzoTool } from '@hanzo/message/api/tools/types';

import ToolDetailsCard from './components/tool-details-card';

export default function RustTool({
  tool,
  isEnabled,
  toolRouterKey,
}: {
  tool: RustHanzoTool;
  isEnabled: boolean;
  toolRouterKey: string;
}) {
  return (
    <ToolDetailsCard
      isEnabled={isEnabled}
      tool={tool}
      toolKey={toolRouterKey}
      toolType="Rust"
    />
  );
}
