/**
 * my-plugin — CoreBlow Plugin
 *
 * CoreBlow plugin: my-plugin
 */


export default {
    meta: {
        name: 'my-plugin',
        version: '0.1.0',
        description: 'CoreBlow plugin: my-plugin',
        author: '',
    },



    async activate(ctx) {
        ctx.log.info('my-plugin activated');
    },

    async deactivate(ctx) {
        ctx.log.info('my-plugin deactivated');
    },
};
