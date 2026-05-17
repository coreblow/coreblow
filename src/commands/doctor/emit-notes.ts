import { t } from "../../infra/i18n/index.js";

export function emitDoctorNotes(params: {
  note: (message: string, title?: string) => void;
  changeNotes?: string[];
  warningNotes?: string[];
}): void {
  for (const change of params.changeNotes ?? []) {
    params.note(change, t("doctor.sections.changes"));
  }
  for (const warning of params.warningNotes ?? []) {
    params.note(warning, t("doctor.sections.warnings"));
  }
}
