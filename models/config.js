module.exports  = {
    urls: {
        game: {
            games: '/games',
            dashboard: '/my-games',
            create: '/game',
            delete: '/delete',
            password: '/password',
            auth: '/authenticate',
            rsvp: '/rsvp'
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
    author: 'Sillvva#2532',
    defaults: {
        sessionStatus: {
            access: {},
            loggedInTo: []
        }
    }
};