import { Category } from "@prisma/client";

export const CATEGORY_LABELS: Record<Category, string> = {
  TEXT_PROMPT: "Text Prompt",
  IMAGE_PROMPT: "Image Prompt",
  VIDEO_PROMPT: "Video Prompt",
  CODE_DEV_PROMPT: "Code / Dev Prompt",
  UI_DESIGN_PROMPT: "UI / Design Prompt",
  SYSTEM_PROMPT: "System Prompt",
  N8N_BLUEPRINT: "n8n Blueprint",
  MAKE_AUTOMATION: "Make Automation",
  CREWAI_SCRIPT: "CrewAI Script",
  LANGCHAIN_PIPELINE: "LangChain Pipeline",
  MCP_SERVER: "MCP Server",
  CURSOR_RULES: "Cursor Rules",
};

export const PLAYGROUND_ELIGIBLE: Category[] = [
  Category.TEXT_PROMPT,
  Category.SYSTEM_PROMPT,
  Category.CODE_DEV_PROMPT,
  Category.CURSOR_RULES,
  Category.MCP_SERVER,
];

export function isPlaygroundEligible(category: Category): boolean {
  return PLAYGROUND_ELIGIBLE.includes(category);
}
