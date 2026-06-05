export class WorkflowStep {
  constructor({ id, command, inputs = {} }) {
    this.id = String(id ?? "").trim();
    this.command = String(command ?? "").trim();
    this.inputs = { ...inputs };
  }

  isRunnable() {
    return this.id.length > 0 && this.command.length > 0;
  }
}

export class WorkflowPlan {
  constructor(steps = []) {
    this.steps = steps.map((step) => step instanceof WorkflowStep ? step : new WorkflowStep(step));
  }

  validate() {
    const ids = new Set();
    const errors = [];
    for (const step of this.steps) {
      if (!step.isRunnable()) {
        errors.push("workflow steps require id and command");
      }
      if (ids.has(step.id)) {
        errors.push(`duplicate workflow step id: ${step.id}`);
      }
      ids.add(step.id);
    }
    return { ok: errors.length === 0, errors };
  }
}
