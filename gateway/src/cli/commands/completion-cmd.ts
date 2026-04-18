/**
 * CoreBlow CLI — `coreblow completion`
 *
 * Generate shell completion scripts for bash, zsh, and fish.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const reset = '\x1b[0m';

const COMMANDS = [
    'setup', 'onboard', 'configure', 'config', 'backup', 'doctor', 'dashboard',
    'reset', 'uninstall', 'message', 'agent', 'agents', 'status', 'health',
    'sessions', 'gateway', 'daemon', 'logs', 'models', 'plugins', 'channels',
    'security', 'secrets', 'skills', 'update', 'completion', 'mcp', 'cron',
    'webhooks', 'chat', 'auth', 'version', 'tui', 'nodes', 'devices',
];

function generateBashCompletion(): string {
    return `# CoreBlow bash completion
# Add to ~/.bashrc: source <(coreblow completion bash)

_coreblow_completions() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local commands="${COMMANDS.join(' ')}"

    if [[ \${COMP_CWORD} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    fi
}

complete -F _coreblow_completions coreblow
`;
}

function generateZshCompletion(): string {
    const items = COMMANDS.map(c => `'${c}:${c} command'`).join('\n      ');
    return `#compdef coreblow
# CoreBlow zsh completion
# Add to ~/.zshrc: source <(coreblow completion zsh)

_coreblow() {
    local -a commands
    commands=(
      ${items}
    )
    _describe 'command' commands
}

compdef _coreblow coreblow
`;
}

function generateFishCompletion(): string {
    return COMMANDS.map(c =>
        `complete -c coreblow -n '__fish_use_subcommand' -a '${c}' -d '${c} command'`
    ).join('\n') + '\n';
}

export function registerCompletionCommand(parent: Command): void {
    parent
        .command('completion')
        .description('Generate shell completion script')
        .argument('<shell>', 'Shell type: bash, zsh, or fish')
        .action((shell: string) => {
            switch (shell.toLowerCase()) {
                case 'bash':
                    console.log(generateBashCompletion());
                    break;
                case 'zsh':
                    console.log(generateZshCompletion());
                    break;
                case 'fish':
                    console.log(generateFishCompletion());
                    break;
                default:
                    console.error(`Unsupported shell: ${shell}. Use: bash, zsh, or fish.`);
                    console.log(`\n  ${bold}Usage:${reset}`);
                    console.log(`  ${cyan}coreblow completion bash${reset} >> ~/.bashrc`);
                    console.log(`  ${cyan}coreblow completion zsh${reset}  >> ~/.zshrc`);
                    console.log(`  ${cyan}coreblow completion fish${reset} > ~/.config/fish/completions/coreblow.fish\n`);
                    process.exitCode = 1;
            }
        });
}
