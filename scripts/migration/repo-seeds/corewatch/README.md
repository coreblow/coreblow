# CoreWatch

CoreBlow issue and pull-request triage automation.

CoreWatch scans repository work queues, classifies maintenance status, and produces reviewable triage recommendations. The repository is separate from CoreBlow core so triage automation can run on its own schedule and store state externally.

## Scope

- Classify issue and pull-request metadata.
- Produce low-risk triage recommendations.
- Keep state in `corewatch-state`.
- Avoid mutating repositories without explicit operator review.

## Development

```sh
npm test
```
