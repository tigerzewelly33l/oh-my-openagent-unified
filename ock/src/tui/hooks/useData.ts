import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { resolveOpencodePath } from "../../utils/errors.js";

export interface ProjectData {
  projectName: string;
  agents: string[];
  skills: string[];
  commands: string[];
  tools: string[];
  mcpServers: string[];
}

export function loadProjectData(): ProjectData {
  const cwd = process.cwd();
  const opencodeDir = resolveOpencodePath() ?? join(cwd, ".opencode");
  const projectName = basename(cwd);

  // Load agents
  const agentDir = join(opencodeDir, "agent");
  let agents: string[] = [];
  if (existsSync(agentDir)) {
    agents = readdirSync(agentDir)
      .filter((f) => f.endsWith(".md") && lstatSync(join(agentDir, f)).isFile())
      .map((f) => f.replace(".md", ""));
  }

  // Load skills
  const skillDir = join(opencodeDir, "skill");
  let skills: string[] = [];
  if (existsSync(skillDir)) {
    skills = readdirSync(skillDir).filter(
      (f) =>
        lstatSync(join(skillDir, f)).isDirectory() && existsSync(join(skillDir, f, "SKILL.md")),
    );
  }

  // Load commands
  const commandDir = join(opencodeDir, "command");
  let commands: string[] = [];
  if (existsSync(commandDir)) {
    commands = readdirSync(commandDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", ""));
  }

  // Load tools
  const toolDir = join(opencodeDir, "tool");
  let tools: string[] = [];
  if (existsSync(toolDir)) {
    tools = readdirSync(toolDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.replace(".ts", ""));
  }

  // Load MCP servers
  const configPath = join(opencodeDir, "opencode.json");
  let mcpServers: string[] = [];
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      mcpServers = Object.keys(config.mcp || {});
    } catch {
      // Ignore parse errors
    }
  }

  return {
    projectName,
    agents,
    skills,
    commands,
    tools,
    mcpServers,
  };
}
