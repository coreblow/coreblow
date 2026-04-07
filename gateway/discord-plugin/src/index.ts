/**
 * discord-plugin — CoreBlow Plugin
 *
 * CoreBlow plugin: discord-plugin
 */


export default {
    meta: {
        name: 'discord-plugin',
        version: '0.1.0',
        description: 'CoreBlow plugin: discord-plugin',
        author: '',
    },



    async activate(ctx) {
        ctx.log.info('discord-plugin activated');
    },

    async deactivate(ctx) {
        ctx.log.info('discord-plugin deactivated');
    },
};
