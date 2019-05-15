module.exports  = {
    urls: {
        game: {
            dashboard: '/games',
            create: '/game',
            delete: '/delete',
            password: '/password',
            auth: '/authenticate'
        },
        invite: '/invite',
        login: '/login',
        timezone: {
            convert: '/tz/:time/:tz',
            countdown: '/cd/:time/:tz'
        }
    },
    defaults: {
        sessionStatus: {
            access: {},
            loggedInTo: []
        }
    }
};