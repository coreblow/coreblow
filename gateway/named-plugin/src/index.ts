/**
 * named-plugin — CoreBlow Plugin
 *
 * CoreBlow plugin: named-plugin
 */


export default {
    meta: {
        name: 'named-plugin',
        version: '0.1.0',
        description: 'CoreBlow plugin: named-plugin',
        author: '',
    },



    async activate(ctx) {
        ctx.log.info('named-plugin activated');
    },

    async deactivate(ctx) {
        ctx.log.info('named-plugin deactivated');
    },
};
