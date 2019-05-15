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
        logout: '/logout',
        timezone: {
            convert: '/tz/:time/:tz',
            countdown: '/cd/:time/:tz'
        }
    },
    formats: {
        dateLong: 'ddd, MMMM Do YYYY, h:mm a'
    },
    defaults: {
        sessionStatus: {
            access: {},
            loggedInTo: []
        }
    }
};