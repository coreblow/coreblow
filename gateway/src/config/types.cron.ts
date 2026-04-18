/** CoreBlow — Types: Cron */ export interface CronJob { name: string; schedule: string; command: string; enabled: boolean; } export type CronConfig = { jobs: CronJob[] };
