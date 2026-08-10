import type { PickedFile } from "@/components/tool/FileGrid";
import type { ToolDef } from "@/lib/tools/registry";

export interface OptionsPanelProps {
  tool: ToolDef;
  files: PickedFile[];
  value: Record<string, unknown>;
  /** Shallow-merges the patch into the current options. */
  onChange: (patch: Record<string, unknown>) => void;
}

export type OptionsPanel = (props: OptionsPanelProps) => React.ReactNode;
