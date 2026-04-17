/**
 * cli/completion.ts
 * Shell completion generation (bash, zsh, fish).
 * Ported from OpenClaw src/cli/completion-cli.ts + completion-fish.ts.
 */

export type Shell = 'bash' | 'zsh' | 'fish';

const COMMANDS = ['start', 'config', 'plugin', 'channel', 'agent', 'session', 'memory', 'tools', 'security', 'status', 'version', 'help'];
const CONFIG_SUBCOMMANDS = ['show', 'set', 'reset', 'validate'];
const PLUGIN_SUBCOMMANDS = ['list', 'install', 'enable', 'disable', 'info', 'uninstall'];
const CHANNEL_SUBCOMMANDS = ['list', 'status', 'restart', 'auth'];

export function generateCompletion(shell: Shell): string {
    switch (shell) {
        case 'bash': return generateBashCompletion();
        case 'zsh': return generateZshCompletion();
        case 'fish': return generateFishCompletion();
    }
}

function generateBashCompletion(): string {
    return `# CoreBlow bash completion
_coreblow() {
    local cur prev words cword
    _init_completion || return

    if [[ \${cword} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "${COMMANDS.join(' ')}" -- "\${cur}") )
        return
    fi

    case "\${words[1]}" in
        config) COMPREPLY=( $(compgen -W "${CONFIG_SUBCOMMANDS.join(' ')}" -- "\${cur}") ) ;;
        plugin) COMPREPLY=( $(compgen -W "${PLUGIN_SUBCOMMANDS.join(' ')}" -- "\${cur}") ) ;;
        channel) COMPREPLY=( $(compgen -W "${CHANNEL_SUBCOMMANDS.join(' ')}" -- "\${cur}") ) ;;
    esac
}
complete -F _coreblow coreblow
`;
}

function generateZshCompletion(): string {
    return `#compdef coreblow
_coreblow() {
    local -a commands
    commands=(
${COMMANDS.map((c) => `        '${c}:${c} management'`).join('\n')}
    )

    _arguments -C \\
        '1: :->command' \\
        '*: :->args'

    case $state in
        command) _describe 'command' commands ;;
        args)
            case $words[2] in
                config) _values 'subcommand' ${CONFIG_SUBCOMMANDS.join(' ')} ;;
                plugin) _values 'subcommand' ${PLUGIN_SUBCOMMANDS.join(' ')} ;;
                channel) _values 'subcommand' ${CHANNEL_SUBCOMMANDS.join(' ')} ;;
            esac
        ;;
    esac
}
_coreblow
`;
}

function generateFishCompletion(): string {
    const lines = ['# CoreBlow fish completion'];
    for (const cmd of COMMANDS) {
        lines.push(`complete -c coreblow -n "__fish_use_subcommand" -a "${cmd}" -d "${cmd} management"`);
    }
    for (const sub of CONFIG_SUBCOMMANDS) {
        lines.push(`complete -c coreblow -n "__fish_seen_subcommand_from config" -a "${sub}"`);
    }
    for (const sub of PLUGIN_SUBCOMMANDS) {
        lines.push(`complete -c coreblow -n "__fish_seen_subcommand_from plugin" -a "${sub}"`);
    }
    for (const sub of CHANNEL_SUBCOMMANDS) {
        lines.push(`complete -c coreblow -n "__fish_seen_subcommand_from channel" -a "${sub}"`);
    }
    return lines.join('\n') + '\n';
}

export function detectShell(): Shell {
    const shellEnv = process.env.SHELL ?? '';
    if (shellEnv.includes('fish')) return 'fish';
    if (shellEnv.includes('zsh')) return 'zsh';
    return 'bash';
}
