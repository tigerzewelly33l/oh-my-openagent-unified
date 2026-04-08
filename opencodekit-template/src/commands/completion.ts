import * as p from "@clack/prompts";
/* eslint-disable no-useless-escape */
import color from "picocolors";
import { CompletionShellSchema } from "../utils/schemas.js";

const BASH_COMPLETION = `# ock bash completion
_ock_completion() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    commands="init config upgrade agent skill doctor status help"
    
    case "\${prev}" in
        ock)
            COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
            return 0
            ;;
        agent)
            COMPREPLY=( \$(compgen -W "list add view" -- "\${cur}") )
            return 0
            ;;
        skill)
            COMPREPLY=( \$(compgen -W "list add view" -- "\${cur}") )
            return 0
            ;;
        config)
            COMPREPLY=( \$(compgen -W "model mcp permission keybinds show" -- "\${cur}") )
            return 0
            ;;
        init)
            COMPREPLY=( \$(compgen -W "--force" -- "\${cur}") )
            return 0
            ;;
        upgrade)
            COMPREPLY=( \$(compgen -W "--force --check" -- "\${cur}") )
            return 0
            ;;
        *)
            ;;
    esac
}
complete -F _ock_completion ock
`;

const ZSH_COMPLETION = `#compdef ock

_ock() {
    local -a commands
    local -a agent_actions
    local -a skill_actions
    local -a config_actions
    
    commands=(
        'init:Initialize OpenCodeKit in current directory'
        'config:Edit opencode.json'
        'upgrade:Update templates to latest version'
        'agent:Manage agents'
        'skill:Manage skills'
        'doctor:Check project health'
        'status:Show project overview'
        'help:Show help'
    )
    
    agent_actions=(
        'list:List all agents'
        'add:Create a new agent'
        'view:View agent details'
    )
    
    skill_actions=(
        'list:List all skills'
        'add:Install a skill'
        'view:View skill details'
    )
    
    config_actions=(
        'model:Change default model'
        'mcp:Manage MCP servers'
        'permission:Edit permissions'
        'keybinds:Edit keyboard shortcuts'
        'show:View current config'
    )
    
    case "\$words[2]" in
        agent)
            _describe -t actions 'agent action' agent_actions
            ;;
        skill)
            _describe -t actions 'skill action' skill_actions
            ;;
        config)
            _describe -t actions 'config action' config_actions
            ;;
        init)
            _arguments '--force[Reinitialize even if already exists]'
            ;;
        upgrade)
            _arguments \\
                '--force[Force upgrade even if up to date]' \\
                '--check[Check for updates only]'
            ;;
        *)
            _describe -t commands 'command' commands
            ;;
    esac
}

_ock "\$@"
`;

const FISH_COMPLETION = `# ock fish completion
complete -c ock -n "__fish_use_subcommand" -a "init" -d "Initialize OpenCodeKit"
complete -c ock -n "__fish_use_subcommand" -a "config" -d "Edit opencode.json"
complete -c ock -n "__fish_use_subcommand" -a "upgrade" -d "Update templates"
complete -c ock -n "__fish_use_subcommand" -a "agent" -d "Manage agents"
complete -c ock -n "__fish_use_subcommand" -a "skill" -d "Manage skills"
complete -c ock -n "__fish_use_subcommand" -a "doctor" -d "Check project health"
complete -c ock -n "__fish_use_subcommand" -a "status" -d "Show project overview"

# agent subcommands
complete -c ock -n "__fish_seen_subcommand_from agent" -a "list" -d "List agents"
complete -c ock -n "__fish_seen_subcommand_from agent" -a "add" -d "Add agent"
complete -c ock -n "__fish_seen_subcommand_from agent" -a "view" -d "View agent"

# skill subcommands
complete -c ock -n "__fish_seen_subcommand_from skill" -a "list" -d "List skills"
complete -c ock -n "__fish_seen_subcommand_from skill" -a "add" -d "Add skill"
complete -c ock -n "__fish_seen_subcommand_from skill" -a "view" -d "View skill"

# config subcommands
complete -c ock -n "__fish_seen_subcommand_from config" -a "model" -d "Change model"
complete -c ock -n "__fish_seen_subcommand_from config" -a "mcp" -d "Manage MCP"
complete -c ock -n "__fish_seen_subcommand_from config" -a "permission" -d "Edit permissions"
complete -c ock -n "__fish_seen_subcommand_from config" -a "keybinds" -d "Edit keybinds"
complete -c ock -n "__fish_seen_subcommand_from config" -a "show" -d "View config"

# init options
complete -c ock -n "__fish_seen_subcommand_from init" -l force -d "Reinitialize"

# upgrade options
complete -c ock -n "__fish_seen_subcommand_from upgrade" -l force -d "Force upgrade"
complete -c ock -n "__fish_seen_subcommand_from upgrade" -l check -d "Check only"
`;

export async function completionCommand(shell?: string) {
	const result = CompletionShellSchema.safeParse(shell);
	const validatedShell = result.success ? result.data : undefined;
	let selectedShell = validatedShell;
	if (!selectedShell) {
		// Interactive selection
		p.intro(color.bgCyan(color.black(" Shell Completion ")));

		const selected = await p.select({
			message: "Select your shell",
			options: [
				{ value: "bash" as const, label: "Bash" },
				{ value: "zsh" as const, label: "Zsh" },
				{ value: "fish" as const, label: "Fish" },
			],
		});

		if (p.isCancel(selected)) {
			p.cancel("Cancelled");
			return;
		}

		selectedShell = selected as "bash" | "zsh" | "fish";
	}

	let script: string;
	let setupInstructions: string;

	switch (selectedShell) {
		case "bash":
			script = BASH_COMPLETION;
			setupInstructions = `Add to ~/.bashrc:
  source <(ock completion bash)

Or save to file:
  ock completion bash > ~/.local/share/bash-completion/completions/ock`;
			break;

		case "zsh":
			script = ZSH_COMPLETION;
			setupInstructions = `Add to ~/.zshrc (before compinit):
  source <(ock completion zsh)

Or save to fpath:
  ock completion zsh > ~/.zsh/completions/_ock
  # Then add to ~/.zshrc: fpath=(~/.zsh/completions $fpath)`;
			break;

		case "fish":
			script = FISH_COMPLETION;
			setupInstructions = `Save to fish completions:
  ock completion fish > ~/.config/fish/completions/ock.fish`;
			break;

		default:
			p.log.error(`Unknown shell: ${shell}`);
			return;
	}

	// Output the script
	console.log(script);

	// Show setup instructions to stderr so they don't interfere with piping
	console.error();
	console.error(color.bold("Setup:"));
	console.error(color.dim(setupInstructions));
}
