/**
 * my-tool-plugin — CoreBlow Plugin
 *
 * CoreBlow plugin: my-tool-plugin
 */

import { exampleTool } from './tools.js';

export default {
    meta: {
        name: 'my-tool-plugin',
        version: '0.1.0',
        description: 'CoreBlow plugin: my-tool-plugin',
        author: '',
    },

    tools: [exampleTool],

    async activate(ctx) {
        ctx.log.info('my-tool-plugin activated');
    },

    async deactivate(ctx) {
        ctx.log.info('my-tool-plugin deactivated');
    },
};
