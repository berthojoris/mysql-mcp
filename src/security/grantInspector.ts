/**
 * Classifies the output of SHOW GRANTS FOR CURRENT_USER(). Anything that is
 * not on the read-only list (including role grants, which cannot be resolved
 * here) counts as a write privilege.
 */
const READ_ONLY_PRIVILEGES = new Set(["SELECT", "SHOW VIEW", "SHOW DATABASES", "PROCESS", "USAGE"]);

export interface GrantInspection {
  readOnly: boolean;
  writePrivileges: string[];
}

export const inspectGrants = (grantLines: string[]): GrantInspection => {
  const writePrivileges = new Set<string>();

  for (const line of grantLines) {
    const match = /^\s*GRANT\s+(.+?)\s+ON\s+/i.exec(line);
    if (!match) {
      // "GRANT `role`@`%` TO ..." assigns a role whose privileges are unknown
      if (/^\s*GRANT\s+/i.test(line)) writePrivileges.add("ROLE");
      continue;
    }
    if (/\bWITH\s+GRANT\s+OPTION\b/i.test(line)) writePrivileges.add("GRANT OPTION");

    // Column privileges look like "SELECT (`a`, `b`)"; drop the column lists
    const privileges = match[1].replace(/\([^)]*\)/g, "").split(",");
    for (const raw of privileges) {
      const privilege = raw.trim().toUpperCase().replace(/\s+/g, " ");
      if (privilege && !READ_ONLY_PRIVILEGES.has(privilege)) writePrivileges.add(privilege);
    }
  }

  return { readOnly: writePrivileges.size === 0, writePrivileges: [...writePrivileges] };
};
