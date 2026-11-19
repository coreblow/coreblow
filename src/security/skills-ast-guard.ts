export type SkillRiskLevel = "low" | "medium" | "high" | "critical";

export interface SkillSecurityFinding {
  rule: string;
  line: number;
  detail: string;
  severity: "medium" | "high" | "critical";
}

export interface SkillSecurityAuditResult {
  safe: boolean;
  riskLevel: SkillRiskLevel;
  findings: SkillSecurityFinding[];
  sourceName?: string;
  scannedLines: number;
}

interface SecurityRule {
  id: string;
  severity: "medium" | "high" | "critical";
  regex: RegExp;
  detail: string;
}

const SECURITY_RULES: SecurityRule[] = [
  // 1. Prompt Injection Overrides
  {
    id: "prompt-injection-override",
    severity: "critical",
    regex: /(?:ignore|disregard|forget|bypass)\s+(?:all\s+|any\s+|prior\s+|previous\s+|system\s+)*(?:instructions|prompts|rules|constraints|system\s+directives|guardrails|safety\s+filters)/i,
    detail: "Detected prompt-injection override attempting to bypass system directives.",
  },
  {
    id: "system-directive-override",
    severity: "critical",
    regex: /(?:system\s+prompt\s+override|you\s+are\s+now\s+in\s+(?:developer|dan|jailbreak|unrestricted)\s+mode|unrestricted\s+mode\s+enabled|disregard\s+all\s+safety)/i,
    detail: "Detected jailbreak pattern attempting to redefine agent operating mode.",
  },
  {
    id: "data-exfiltration-prompt",
    severity: "critical",
    regex: /(?:exfiltrat(?:e|ion)|covertly\s+send|silently\s+transmit|leak|steal|send\s+out)[\s\S]*?(?:token|secret|password|key|credential|private|\.env)/i,
    detail: "Detected instruction to secretly extract or exfiltrate sensitive credentials.",
  },

  // 2. Obfuscated Shell / Destructive Execution
  {
    id: "obfuscated-shell-download",
    severity: "critical",
    regex: /(?:curl|wget)\s+[\s\S]*?\|\s*(?:ba|z|da)?sh\b/i,
    detail: "Detected pipe-to-shell remote execution pattern ('curl ... | bash').",
  },
  {
    id: "destructive-filesystem-deletion",
    severity: "critical",
    regex: /rm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|-[a-zA-Z]*r[a-zA-Z]*\s+-[a-zA-Z]*f[a-zA-Z]*|--recursive\s+--force|--force\s+--recursive)\s+(?:\/|\/\*|~|~\/|~\/\*|\$HOME|\$HOME\/\*|\.\/|\.\.\/?)(?:\s|$|;)/i,
    detail: "Detected destructive root or home directory recursive file deletion ('rm -rf /').",
  },
  {
    id: "fork-bomb-dos",
    severity: "critical",
    regex: /:\(\)\s*\{\s*:\|:&\s*\};:/,
    detail: "Detected fork bomb denial-of-service pattern.",
  },
  {
    id: "obfuscated-eval",
    severity: "critical",
    regex: /(?:eval|Function)\s*\(\s*(?:atob|Buffer\.from)\s*\(/i,
    detail: "Detected obfuscated dynamic evaluation via base64 decoding ('eval(atob(...)').",
  },

  // 3. Credential Harvesting
  {
    id: "ssh-key-harvesting",
    severity: "critical",
    regex: /(?:\.ssh\/(?:id_rsa|id_ed25519|id_dsa|authorized_keys|known_hosts))/i,
    detail: "Attempted access to private SSH keys or authorized_keys.",
  },
  {
    id: "system-shadow-harvesting",
    severity: "critical",
    regex: /(?:\/etc\/shadow|\/etc\/gshadow|\/etc\/master\.passwd)/i,
    detail: "Attempted access to privileged system authentication shadow database.",
  },
  {
    id: "env-credential-exfiltration",
    severity: "critical",
    regex: /(?:\.env\b[\s\S]*?(?:exfil|curl|wget|webhook|upload|pastebin))|(?:(?:curl|fetch|wget|axios|http\.post)[\s\S]*?\.env\b)/i,
    detail: "Detected attempt to upload or exfiltrate environment credentials.",
  },

  // 4. Suspicious Outbound Raw IP Beacons
  {
    id: "suspicious-raw-ip-beacon",
    severity: "critical",
    regex: /https?:\/\/(?!127\.0\.0\.1|0\.0\.0\.0|localhost)(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]{1,5})?(?:\/[^\s"']*)?.*(?:beacon|exfil|callback|ping|collector|c2|payload)/i,
    detail: "Detected outbound beacon targeting an external raw IP endpoint.",
  },
  {
    id: "outbound-raw-ip",
    severity: "high",
    regex: /https?:\/\/(?!127\.0\.0\.1|0\.0\.0\.0|localhost|10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.)(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]{1,5})?(?:\/[^\s"']*)?/i,
    detail: "Detected hardcoded public raw IP URL (risk of unmonitored egress).",
  },
];

/**
 * Performs static security analysis on skill Markdown or script contents.
 * Returns safe: false and riskLevel: "critical" if dangerous patterns are detected.
 */
export function auditSkillSecurity(
  content: string,
  sourceName?: string,
): SkillSecurityAuditResult {
  if (!content || typeof content !== "string") {
    return {
      safe: true,
      riskLevel: "low",
      findings: [],
      sourceName,
      scannedLines: 0,
    };
  }

  const lines = content.split(/\r?\n/);
  const findings: SkillSecurityFinding[] = [];
  const matchedRuleIds = new Set<string>();

  // 1. Line-by-line scanning (for precise line reporting)
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const lineText = lines[idx];

    for (const rule of SECURITY_RULES) {
      if (rule.regex.test(lineText)) {
        findings.push({
          rule: rule.id,
          line: lineNum,
          detail: rule.detail,
          severity: rule.severity,
        });
        matchedRuleIds.add(rule.id);
      }
    }
  }

  // 2. Multiline & backslash-continuation normalized scanning
  // Normalize escaped newlines (e.g. 'curl ... \\\n | bash')
  const normalizedContent = content.replace(/\\\r?\n\s*/g, " ");
  for (const rule of SECURITY_RULES) {
    if (!matchedRuleIds.has(rule.id)) {
      const match = rule.regex.exec(normalizedContent) ?? rule.regex.exec(content);
      if (match) {
        // Calculate line number where the match began
        const prefix = content.slice(0, match.index);
        const matchLine = prefix.split(/\r?\n/).length;
        findings.push({
          rule: rule.id,
          line: matchLine,
          detail: rule.detail,
          severity: rule.severity,
        });
        matchedRuleIds.add(rule.id);
      }
    }
  }

  // Determine aggregate risk
  let riskLevel: SkillRiskLevel = "low";
  let hasCritical = false;
  let hasHigh = false;
  let hasMedium = false;

  for (const f of findings) {
    if (f.severity === "critical") hasCritical = true;
    else if (f.severity === "high") hasHigh = true;
    else if (f.severity === "medium") hasMedium = true;
  }

  if (hasCritical) {
    riskLevel = "critical";
  } else if (hasHigh) {
    riskLevel = "high";
  } else if (hasMedium) {
    riskLevel = "medium";
  }

  const safe = riskLevel === "low" || riskLevel === "medium";

  return {
    safe,
    riskLevel,
    findings,
    sourceName,
    scannedLines: lines.length,
  };
}
