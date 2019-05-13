module.exports  = {
    urls: {
        game: {
            create: '/game',
            delete: '/delete',
            password: '/password',
            auth: '/authenticate'
        },
        invite: '/invite'
    },
    defaults: {
        sessionStatus: {
            loggedInTo: []
        }
    }
};