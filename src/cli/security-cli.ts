import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { isRich, theme } from "../terminal/theme.js";
import { formatCliCommand } from "./command-format.js";
import { formatHelpExamples } from "./help-format.js";

type SecurityAuditOptions = {
  json?: boolean;
  deep?: boolean;
  fix?: boolean;
  token?: string;
  password?: string;
};

function formatSummary(summary: { critical: number; warn: number; info: number }): string {
  const rich = isRich();
  const c = summary.critical;
  const w = summary.warn;
  const i = summary.info;
  const parts: string[] = [];
  parts.push(rich ? theme.error(`${c} critical`) : `${c} critical`);
  parts.push(rich ? theme.warn(`${w} warn`) : `${w} warn`);
  parts.push(rich ? theme.muted(`${i} info`) : `${i} info`);
  return parts.join(" · ");
}

export function registerSecurityCli(program: Command) {
  const security = program
    .command("security")
    .description("Audit local config and state for common security foot-guns")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["coreblow security audit", "Run a local security audit."],
          ["coreblow security audit --deep", "Include best-effort live Gateway probe checks."],
          ["coreblow security audit --deep --token <token>", "Use explicit token for deep probe."],
          [
            "coreblow security audit --deep --password <password>",
            "Use explicit password for deep probe.",
          ],
          ["coreblow security audit --fix", "Apply safe remediations and file-permission fixes."],
          ["coreblow security audit --json", "Output machine-readable JSON."],
        ])}\n\n${theme.muted("Docs:")} ${formatDocsLink("/cli/security", "docs.coreblow.com/cli/security")}\n`,
    );

  security
    .command("audit")
    .description("Audit config + local state for common security foot-guns")
    .option("--deep", "Attempt live Gateway probe (best-effort)", false)
    .option("--token <token>", "Use explicit gateway token for deep probe auth")
    .option("--password <password>", "Use explicit gateway password for deep probe auth")
    .option("--fix", "Apply safe fixes (tighten defaults + chmod state/config)", false)
    .option("--json", "Print JSON", false)
    .action(async (opts: SecurityAuditOptions) => {
      const [
        { loadConfig },
        { runSecurityAudit },
        { resolveCommandSecretRefsViaGateway },
        { getSecurityAuditCommandSecretTargetIds },
        { shortenHomeInString, shortenHomePath },
      ] = await Promise.all([
        import("../config/config.js"),
        import("../security/audit.js"),
        import("./command-secret-gateway.js"),
        import("./command-secret-targets.js"),
        import("../utils.js"),
      ]);
      const fixResult = opts.fix
        ? await import("../security/fix.js")
            .then(({ fixSecurityFootguns }) => fixSecurityFootguns())
            .catch((_err) => null)
        : null;

      const sourceConfig = loadConfig();
      const { resolvedConfig: cfg, diagnostics: secretDiagnostics } =
        await resolveCommandSecretRefsViaGateway({
          config: sourceConfig,
          commandName: "security audit",
          targetIds: getSecurityAuditCommandSecretTargetIds(),
          mode: "read_only_status",
        });
      const report = await runSecurityAudit({
        config: cfg,
        sourceConfig,
        deep: Boolean(opts.deep),
        includeFilesystem: true,
        includeChannelSecurity: true,
        deepProbeAuth:
          opts.token?.trim() || opts.password?.trim()
            ? {
                ...(opts.token?.trim() ? { token: opts.token } : {}),
                ...(opts.password?.trim() ? { password: opts.password } : {}),
              }
            : undefined,
      });

      if (opts.json) {
        defaultRuntime.writeJson(
          fixResult
            ? { fix: fixResult, report, secretDiagnostics }
            : { ...report, secretDiagnostics },
        );
        return;
      }

      const rich = isRich();
      const heading = (text: string) => (rich ? theme.heading(text) : text);
      const muted = (text: string) => (rich ? theme.muted(text) : text);

      const lines: string[] = [];
      lines.push(heading("CoreBlow security audit"));
      lines.push(muted(`Summary: ${formatSummary(report.summary)}`));
      lines.push(muted(`Run deeper: ${formatCliCommand("coreblow security audit --deep")}`));
      for (const diagnostic of secretDiagnostics) {
        lines.push(muted(`[secrets] ${diagnostic}`));
      }

      if (opts.fix) {
        lines.push(muted(`Fix: ${formatCliCommand("coreblow security audit --fix")}`));
        if (!fixResult) {
          lines.push(muted("Fixes: failed to apply (unexpected error)"));
        } else if (
          fixResult.errors.length === 0 &&
          fixResult.changes.length === 0 &&
          fixResult.actions.every((a) => !a.ok)
        ) {
          lines.push(muted("Fixes: no changes applied"));
        } else {
          lines.push("");
          lines.push(heading("FIX"));
          for (const change of fixResult.changes) {
            lines.push(muted(`  ${shortenHomeInString(change)}`));
          }
          for (const action of fixResult.actions) {
            if (action.kind === "chmod") {
              const mode = action.mode.toString(8).padStart(3, "0");
              if (action.ok) {
                lines.push(muted(`  chmod ${mode} ${shortenHomePath(action.path)}`));
              } else if (action.skipped) {
                lines.push(
                  muted(`  skip chmod ${mode} ${shortenHomePath(action.path)} (${action.skipped})`),
                );
              } else if (action.error) {
                lines.push(
                  muted(`  chmod ${mode} ${shortenHomePath(action.path)} failed: ${action.error}`),
                );
              }
              continue;
            }
            const command = shortenHomeInString(action.command);
            if (action.ok) {
              lines.push(muted(`  ${command}`));
            } else if (action.skipped) {
              lines.push(muted(`  skip ${command} (${action.skipped})`));
            } else if (action.error) {
              lines.push(muted(`  ${command} failed: ${action.error}`));
            }
          }
          if (fixResult.errors.length > 0) {
            for (const err of fixResult.errors) {
              lines.push(muted(`  error: ${shortenHomeInString(err)}`));
            }
          }
        }
      }

      const bySeverity = (sev: "critical" | "warn" | "info") =>
        report.findings.filter((f) => f.severity === sev);

      const render = (sev: "critical" | "warn" | "info") => {
        const list = bySeverity(sev);
        if (list.length === 0) {
          return;
        }
        const label =
          sev === "critical"
            ? rich
              ? theme.error("CRITICAL")
              : "CRITICAL"
            : sev === "warn"
              ? rich
                ? theme.warn("WARN")
                : "WARN"
              : rich
                ? theme.muted("INFO")
                : "INFO";
        lines.push("");
        lines.push(heading(label));
        for (const f of list) {
          lines.push(`${theme.muted(f.checkId)} ${f.title}`);
          lines.push(`  ${f.detail}`);
          if (f.remediation?.trim()) {
            lines.push(`  ${muted(`Fix: ${f.remediation.trim()}`)}`);
          }
        }
      };

      render("critical");
      render("warn");
      render("info");

      defaultRuntime.log(lines.join("\n"));
    });

  const rbac = security
    .command("rbac")
    .description("Manage persistent Gateway RBAC roles and principal bindings");

  rbac
    .command("list")
    .description("List RBAC roles and active principal bindings")
    .option("--principal <id>", "Filter bindings by principal id")
    .option("--all", "Include expired bindings", false)
    .option("--json", "Print JSON", false)
    .action(async (opts: { principal?: string; all?: boolean; json?: boolean }) => {
      const { PersistentRbacStore } = await import("../security/rbac-store.js");
      const store = new PersistentRbacStore();
      try {
        const roles = store.listRoles();
        const bindings = store.listBindings({
          principalId: opts.principal,
          includeExpired: opts.all,
        });
        const bootstrapMode = store.getBootstrapMode();
        if (opts.json) {
          defaultRuntime.writeJson({ dbPath: store.dbPath, bootstrapMode, roles, bindings });
          return;
        }
        const lines = [
          `RBAC Store: ${store.dbPath} (bootstrap=${bootstrapMode ?? "none"})`,
          `Roles (${roles.length}): ${roles.map((r) => r.name).join(", ")}`,
          `Bindings (${bindings.length}):`,
          ...bindings.map(
            (b) =>
              `  - ${b.principalId} -> ${b.roleName} (by ${b.grantedBy}${b.expiresAtMs ? `, expires ${new Date(b.expiresAtMs).toISOString()}` : ""})`,
          ),
        ];
        defaultRuntime.log(lines.join("\n"));
      } finally {
        store.close();
      }
    });

  rbac
    .command("grant")
    .description("Grant an RBAC role to a principal")
    .requiredOption("--principal <id>", "Principal id (e.g. device:<id> or client:<id>)")
    .requiredOption("--role <role>", "Role name (owner, admin, operator, viewer)")
    .option("--expires-in <duration>", "Optional TTL duration (e.g. 30m, 24h, 7d)")
    .option("--json", "Print JSON", false)
    .action(
      async (opts: { principal: string; role: string; expiresIn?: string; json?: boolean }) => {
        const { PersistentRbacStore, parseDurationToMs, formatRedactedRbacAudit } = await import(
          "../security/rbac-store.js"
        );
        const { invalidateGatewayRbacCache } = await import("../gateway/rbac-runtime.js");
        const store = new PersistentRbacStore();
        try {
          const expiresAtMs = opts.expiresIn
            ? Date.now() + parseDurationToMs(opts.expiresIn)
            : null;
          const binding = store.grantBinding({
            principalId: opts.principal,
            roleName: opts.role,
            grantedBy: "cli",
            expiresAtMs,
          });
          invalidateGatewayRbacCache();
          if (opts.json) {
            defaultRuntime.writeJson({ ok: true, binding });
            return;
          }
          defaultRuntime.log(
            formatRedactedRbacAudit(
              `Granted role '${binding.roleName}' to '${binding.principalId}'`,
            ),
          );
        } finally {
          store.close();
        }
      },
    );

  rbac
    .command("revoke")
    .description("Revoke an RBAC role from a principal")
    .requiredOption("--principal <id>", "Principal id")
    .requiredOption("--role <role>", "Role name")
    .option("--json", "Print JSON", false)
    .action(async (opts: { principal: string; role: string; json?: boolean }) => {
      const { PersistentRbacStore, formatRedactedRbacAudit } = await import(
        "../security/rbac-store.js"
      );
      const { invalidateGatewayRbacCache } = await import("../gateway/rbac-runtime.js");
      const store = new PersistentRbacStore();
      try {
        const revoked = store.revokeBinding({
          principalId: opts.principal,
          roleName: opts.role,
        });
        invalidateGatewayRbacCache();
        if (opts.json) {
          defaultRuntime.writeJson({
            ok: true,
            revoked,
            principalId: opts.principal,
            roleName: opts.role,
          });
          return;
        }
        defaultRuntime.log(
          formatRedactedRbacAudit(
            revoked
              ? `Revoked role '${opts.role}' from '${opts.principal}'`
              : `No binding found for '${opts.principal}' -> '${opts.role}'`,
          ),
        );
      } finally {
        store.close();
      }
    });
}
