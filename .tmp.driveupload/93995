/**
 * full-plugin — CoreBlow Plugin
 *
 * CoreBlow plugin: full-plugin
 */

import { exampleTool } from './tools.js';
import { messageHook } from './hooks.js';
import { statusCommand } from './commands.js';
import { configSchema } from './config.js';

export default {
    meta: {
        name: 'full-plugin',
        version: '0.1.0',
        description: 'CoreBlow plugin: full-plugin',
        author: '',
    },

    tools: [exampleTool],
    hooks: [messageHook],
    commands: [statusCommand],
    configSchema,

    async activate(ctx) {
        ctx.log.info('full-plugin activated');
    },

    async deactivate(ctx) {
        ctx.log.info('full-plugin deactivated');
    },
};
