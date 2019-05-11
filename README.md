# RPG Schedule

A discord bot for posting game announcements for RPGs. Features include: 

- Web interface for posting and editing game announcements
- Automated or manual sign ups and automated waitlisting
- Automated reminders

**Note:** Games are automatically pruned 48 - 72 hours after the scheduled time. Or you can delete them manually.

<img src="http://rpg-schedule.herokuapp.com/images/screenshot.png" width="600">
<img src="http://rpg-schedule.herokuapp.com/images/screenshot2.png" width="600">

## Inviting the discord bot

You can invite the discord bot to your server with the following link:

https://rpg-schedule.herokuapp.com

## Command List
Command | Description
--- | ---
**General Commands** | 
!schedule | Displays the help menu
!schedule help | Displays the help menu
**Configuration** | 
!schedule channel #channel-name | Configure the channel where games are posted (recommended)
!schedule password password | Configure the password for posting games
!schedule password | Remove the password
**Usage** | 
!schedule link | Retrieve the link for posting games

## About the bot

The discord bot is deployed with Heroku as a Node.js and discord.js application and MongoDB for data storage. When an update is pushed to this repository, the update is automatically deployed to Heroku.