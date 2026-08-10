import type { ToolSlug } from "@/lib/tools/registry";

import { en } from "./dictionaries/en";
import { id } from "./dictionaries/id";
import type { Dictionary } from "./index";

export interface ToolCopy {
  name: string;
  short: string;
  lead: string;
}

/*
 * Both dictionaries must cover every registered tool. If a slug is added to the
 * registry without matching copy, these two lines fail to compile.
 */
const _idCovers: Record<ToolSlug, ToolCopy> = id.tools;
const _enCovers: Record<ToolSlug, ToolCopy> = en.tools;
void _idCovers;
void _enCovers;

export function getToolCopy(t: Dictionary, slug: string): ToolCopy {
  const copy = (t.tools as Record<string, ToolCopy | undefined>)[slug];
  return copy ?? { name: slug, short: "", lead: "" };
}
