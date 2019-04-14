# rpg-schedule

A discord bot for announcing RPG games with automated sign up

## Inviting the discord bot

You can invite the discord bot to your server with the following link:

https://rpg-schedule.herokuapp.com

## Setting up the discord bot

The discord bot is deployed with Heroku as a Node.js application and MongoDB for data storage. When an update is pushed to this repository, the update is automatically deployed to Heroku.

### Environment Variables

The bot uses environment variables to store sensitive information. Here are the environment variables in use.

- BOTCOMMAND_SCHEDULE - the command used to access the bot functions in Discord. (!schedule)
- HOST - the url of the bot's built in web server (https://rpg-schedule.herokuapp.com)
- INVITE - the bot invite url
- MONGODB_URL - the url of the MongoDB server
- TOKEN - the bot's discord token
