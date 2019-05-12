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

<table>
<thead>
<tr>
<th>Command&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</th>
<th>Default&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>General Commands</strong></td>
<td></td>
<td></td>
</tr>
<tr>
<td>!schedule</td>
<td></td>
<td>Displays the help menu</td>
</tr>
<tr>
<td>!schedule help</td>
<td></td>
<td>Displays the help menu</td>
</tr>
<tr>
<td><strong>Configuration</strong></td>
<td></td>
<td></td>
</tr>
<tr>
<td>!schedule channel <code>#channel-name</code></td>
<td>first text channel</td>
<td>Configure the channel where games are posted (recommended)</td>
</tr>
<tr>
<td>!schedule pruning <code>on/off</code></td>
<td>off</td>
<td>Automatically delete old game announcements. As noted above, games over 48 hours past their scheduled date are automatically pruned from the database. However, by default the announcements are not.</td>
</tr>
<tr>
<td>!schedule password <code>password</code></td>
<td>disabled</td>
<td>Configure the password for posting games</td>
</tr>
<tr>
<td>!schedule password</td>
<td></td>
<td>Remove the password</td>
</tr>
<tr>
<td><strong>Usage</strong></td>
<td></td>
<td></td>
</tr>
<tr>
<td>!schedule link</td>
<td></td>
<td>Retrieve the link for posting games</td>
</tr>
</tbody>
</table>

## About the bot

The discord bot is deployed with Heroku as a Node.js and discord.js application and MongoDB for data storage. When an update is pushed to this repository, the update is automatically deployed to Heroku.