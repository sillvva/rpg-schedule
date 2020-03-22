# RPG Schedule

A discord bot for posting game announcements for RPGs. Features include:

- Web interface for posting and editing game announcements
- Automated or manual sign ups and automated waitlisting
- Automated rescheduling (daily, weekly, biweekly, or monthly)
- Automated reminders
- RSS Feed

**Note:** Games are automatically pruned 48 - 72 hours after the scheduled time. Or you can delete them manually.

<details>
  <summary>Screenshots</summary>
  <a href="https://www.rpg-schedule.com/images/screenshot3.png" target="_blank" style="display: inline-flex; height: 200px;"><img src="https://www.rpg-schedule.com/images/screenshot3.png" style="max-width: 100%; max-height: 100%;"></a>
  <a href="https://www.rpg-schedule.com/images/screenshot4.png" target="_blank" style="display: inline-flex; height: 200px;"><img src="https://www.rpg-schedule.com/images/screenshot4.png" style="max-width: 100%; max-height: 100%;"></a>
  <a href="https://www.rpg-schedule.com/images/screenshot.png" target="_blank" style="display: inline-flex; height: 200px;"><img src="https://www.rpg-schedule.com/images/screenshot.png" style="max-width: 100%; max-height: 100%;"></a>
  <a href="https://www.rpg-schedule.com/images/screenshot2.png" target="_blank" style="display: inline-flex; height: 200px;"><img src="https://www.rpg-schedule.com/images/screenshot2.png" style="max-width: 100%; max-height: 100%;"></a>
</details>

## Inviting the discord bot

You can invite the discord bot to your server with the following link:

https://www.rpg-schedule.com/

## Command List

<table>
<thead>
<tr>
<th>Command&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</th>
<th>Default&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</th>
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
<td><strong>General Configuration</strong></td>
<td></td>
<td></td>
</tr>
<tr>
<td>!schedule configuration</td>
<td></td>
<td>Get the bot configuration</td>
</tr>
<tr>
<td>!schedule role <code>role name</code></td>
<td>All Roles</td>
<td>Assign a role as a prerequisite for posting games</td>
</tr>
<tr>
<td>!schedule manager-role <code>role name</code></td>
<td>Server Admins</td>
<td>Assign a role to allow managing all server games</td>
</tr>
<tr>
<td>!schedule password <code>password</code></td>
<td>disabled</td>
<td>Configure a password for posting games</td>
</tr>
<tr>
<td>!schedule password</td>
<td></td>
<td>Remove the password</td>
</tr>
<tr>
<td>!schedule lang <code>en</code></td>
<td><code>en</code> (English)</td>
<td>Set the bot's language.</td>
</tr>
<tr>
<td><strong>Bot Configuration</strong></td>
<td></td>
<td></td>
</tr>
<tr>
<td>!schedule embeds <code>on/off</code></td>
<td>on</td>
<td>Use discord embeds for announcements</td>
</tr>
<tr>
<td>!schedule embed-color <code>color</code></td>
<td>#2196f3</td>
<td>Set a discord embed color. Can be a color name like <code>red</code> or a hexadecimal color like <code>#2196f3</code></td>
</tr>
<tr>
<td>!schedule embed-user-tags <code>on/off</code></td>
<td>off</td>
<td>Include user tags in announcement embeds (<a href="https://cdn.discordapp.com/attachments/532565396746928149/682786099679985665/unknown.png" target="_blank">Can occasionally glitch</a>)</td>
</tr>
<tr>
<td>!schedule emoji-sign-up ➕</td>
<td>➕</td>
<td>Set the emoji used for automated sign up</td>
</tr>
<tr>
<td>!schedule emoji-drop-out ➖</td>
<td>➖</td>
<td>Set the emoji used for automated sign up</td>
</tr>
<tr>
<td>!schedule toggle-drop-out</td>
<td>Off</td>
<td>Enable/disable the ability for players to drop out</td>
</tr>
<tr>
<td>!schedule prefix-char <code>?</code></td>
<td>!</td>
<td>Set the prefix character for sending bot commands</td>
</tr>
<tr>
<td><strong>Game Configuration</strong></td>
<td></td>
<td></td>
</tr>
<tr>
<td>!schedule add-channel <code>#channel-name</code></td>
<td>first text channel</td>
<td>Add a channel where games are posted (recommended)</td>
</tr>
<tr>
<td>!schedule remove-channel <code>#channel-name</code></td>
<td></td>
<td>Remove a channel where games are posted</td>
</tr>
<tr>
<td>!schedule pruning <code>on/off</code></td>
<td>off</td>
<td>Automatically delete old game announcements. As noted above, games over 48 hours past their scheduled date are automatically pruned from the database. However, by default the announcements are not.</td>
</tr>
<tr>
<td>!schedule private-reminders</td>
<td>Off</td>
<td>Toggle whether the game reminders are sent to private messages.</td>
</tr>
<tr>
<td>!schedule reschedule-mode</td>
<td>repost</td>
<td>
  Available modes:<br />
  <ul>
    <li><code>repost</code> - Creates a new announcement post</li>
    <li><code>update</code> - Updates the original announcement post</li>
  </ul>
</td>
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

## Rescheduling

Here's how rescheduling works:

You enter: 3/20 (Fri) 9am, Reschedule: Weekly, Friday
- First announcement says 3/20 (Fri) 9am
- Next announcement says 3/27 (Fri) 9am
- Next announcement says 4/3 (Fri) 9am

You enter 3/25 (Wed) 9am, Reschedule: Weekly, Friday
- First announcement says 3/25 (Wed) 9am
- Next announcement says 3/27 (Fri) 9am
- Next announcement says 4/3 (Fri) 9am

The first announcement is always on the date you entered. Any following announcements will be based on the day of the week selected.

Each next announcement will be posted X hours after the date/time of the current announcement, where X is the duration of the game. If no duration is entered, it defaults to 0 hours.

## How to Develop
* install [git](https://git-scm.com/downloads), [node](https://nodejs.org/en/download/), [heroku-cli](https://devcenter.heroku.com/articles/heroku-cli#download-and-install), and [mongodb server](https://www.mongodb.com/download-center/community)
* Run `npm install`
* Set up a [discord bot application](https://discordapp.com/developers) with permissions and a token
  * permissions: 
    * send messages
    * manage messages
    * embed links
    * read message history
    * add reactions
  * OAuth2 redirect
    * `http://localhost:5000/login`
      * guilds
      * identify
* Copy `.env template` to `.env` and fill out values
* Start mongodb
* Run `npm start`

## About the bot

The discord bot is deployed with Heroku as a Node.js and discord.js application and MongoDB for data storage. When an update is pushed to this repository, the update is automatically deployed to Heroku.

[Change Log](https://github.com/sillvva/rpg-schedule/blob/master/CHANGELOG.md)

Donate: [Patreon](https://www.patreon.com/rpg_schedule) | [PayPal](https://www.paypal.me/Sillvva) | [My Website](https://www.mattdekok.dev/#donate)
