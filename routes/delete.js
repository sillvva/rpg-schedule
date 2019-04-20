const express = require('express');
const discord = require('discord.js');

const Game = require('../models/game');

module.exports = (options) => {
    const router = express.Router();
    // const { client } = options;

    router.use('/delete', async (req, res, next) => {
        try {
            if (req.query.g) {
                const game = await Game.fetch(req.query.g);
                if (!game) throw new Error('Game not found');
                const channelId = game.c;
                const serverId = game.s;

                const channel = guild.channels.get(channelId);

                Game.delete(game, channel).then(response => {
                    res.redirect(Game.url+'?s='+serverId);
                });
            } else {
                throw new Error('Game not found');
            }
        } catch(err) {
            res.render('error', { message: err });
        }
    });

    return router;
};