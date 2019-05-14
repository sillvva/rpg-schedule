module.exports  = {
    urls: {
        game: {
            create: '/game',
            delete: '/delete',
            password: '/password',
            auth: '/authenticate'
        },
        invite: '/invite',
        timezone: {
            convert: '/tz/:time/:tz',
            countdown: '/cd/:time/:tz'
        }
    },
    defaults: {
        sessionStatus: {
            loggedInTo: []
        }
    }
};