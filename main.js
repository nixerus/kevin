//CORE LIBRARIES
const fs = require('fs');
const store = require('data-store')({ path: process.cwd() + '/data/redditpostdata.json' });
//discord
const Discord = require("discord.js");
const bot = new Discord.Client;

//configuration
const config = require("./data/config.json");

//reddit
const snoowrap = require('snoowrap');

//TODO: should not be username/password
let reddit;
let gtvsub;

if(config.subreddit !== "") {
    reddit = new snoowrap({
        userAgent: 'updates a spreadsheet with the list of approved members',
        clientId: config.credentials.reddit.clientId,
        clientSecret: config.credentials.reddit.clientSecret,
        username: config.credentials.reddit.username,
        password: config.credentials.reddit.password
    });
    gtvsub = reddit.getSubreddit(config.environment.subreddit);
}

const suggestions = require('./suggestions');

const helpmsg = new Discord.MessageEmbed;
helpmsg.title = 'Help';
helpmsg.description = '**Main**\n!gtv help -*Shows this message*\n/demographics - Shows Demographic Information';
//!gtv star leaderboard [page ex. 1,2,3] - *Shows a leaderboard of who has gotten the most stars*;

bot.on("ready", async () => {
    console.log(`Logged in as ${bot.user.tag}!`);

    if(config.subreddit !== "") {
        checkfornewpost();
        setInterval(function tick() {
            checkfornewpost();
        }, 60000);
    }
});

bot.on("guildMemberAdd", async (member) => {
    if (member.guild.id == config.guild.id) {
        let channel = bot.channels.cache.get(config.guild.serverLogChannel);
        let msg = await channel.send(`Welcome to the server ${member.user.tag}!`);
        msg.react('👋');
    }
})

bot.on("guildMemberRemove", async (member) => {
    if (member.guild.id == '') {
        bot.api.channels(config.guild.serverLogChannel).messages.post({
            data: {
                content:`${member.user.tag} just left the server 🙁`
            }
        });
    }
})

bot.on("message", async (msg) => {
    const guild = await bot.guilds.fetch(config.guild.id);
    // Birthday Message
    if (msg.author.id == config.guild.birthdayBotId && msg.channel.id == config.guild.birthdays.birthdayChannel) {
        const general = await bot.channels.cache.get(config.guild.birthdays.announcementChannel);
        const mess = await general.send(msg.content);
        mess.react('🎂');
    }

    if(msg.author.bot) {
        return;
    }

    // DM (Direct Message) Handling
    if (msg.channel.type == 'dm') {
        if (guild.member(msg.author).roles.cache.has('') == false) {
            const date = new Date();
            const datestring = date.toLocaleString('en-GB', { timeZone: 'UTC' });
            content = msg.content;
            if (msg.attachments.array().length > 0) {
                const attachments = msg.attachments.array();
                for (i=0; i < attachments.length; i++) {
                    content = content + '\n' + attachments[i].url.toString();
                } 
            }
            const logchannel = await bot.channels.cache.get(config.guild.botLogChannel);
            let logmsg = `DM From ${msg.author} at ${datestring}:\n${Discord.Util.removeMentions(content)}`;
            logchannel.send(logmsg);
        }
    }

    const originalArgs = msg.content.split(" ");
    const args = msg.content.split(" ").map(item => item.toLowerCase());

    for (i=0; i < args.length; i++) {
        if (args[i][0] == 't' && args[i+1] != undefined && args[i+1][0] == 'j') {
            const TJ = guild.member(bot.users.cache.get(config.users.tjUserId));
            TJ.setNickname(`${originalArgs[i]} ${originalArgs[i+1]}`,'Automated TJ Nicknaming');
        }
    }

    if (args[0] == "?suggest") {
        let channel = await bot.channels.cache.get(config.guild.suggestions.channel);
        let returnMsg = await suggestions.newSuggestion(msg, channel);
        msg.channel.send(returnMsg.message);
        config.guild.suggestions.reactions.forEach((reaction) => {
            returnMsg.suggestionMsg.react(reaction);
        });
    } else if (args[0] == "?deletesuggestion") {
        if (args[1] == '0') {
            msg.channel.send('Reserved Suggestion Number.');
        }
        let suggestionChannel = await bot.channels.cache.get(config.guild.suggestions.channel);
        let response = await suggestions.deleteSuggestion(args[1],msg.author.id);
        if (response.status == false) {
            msg.channel.send(response.error);
        } else {
            let message = await suggestionChannel.messages.fetch(response.message_id);
            message.delete();
            msg.channel.send(`Suggestion #${response.id} deleted. It read ` + '`' + Discord.Util.removeMentions(response.desc) + '`.');
        }
    } else if (args[0] == "?suggestionchannel") { 
        let admin = false;
        try {
            admin = msg.member.hasPermission('ADMINISTRATOR');
        } catch (e) {
            msg.channel.send(`Must do this command in server where suggestions is enabled!`);
            return;
        }
        if (admin == true) {
            if (args[1] == null) {
                msg.channel.send('Please send a channel to change suggestions to.');
            } else {
                let channelid = args[1];
                channelid = channelid.replace('>','');
                channelid = channelid.replace('#','');
                channelid = channelid.replace('<','');
                try {
                    let oldchannel = await bot.channels.cache.get(config.guild.suggestions.channel);
                    starchannel = await bot.channels.cache.get(channelid);
                    const webhooks = await oldchannel.fetchWebhooks();
		            const webhook = webhooks.first();
                    await webhook.edit({
                        name:msg.author.username,
                        avatar:msg.author.avatarURL(),
                        channel: channelid
                    });
                    config.guild.suggestions.channel = channelid;
                    fs.writeFileSync('./data/config.json', JSON.stringify(config, null, 2));
                    msg.channel.send(`Suggestions channel set to ${starchannel}!`);
                    return;
                } catch(e) {
                    console.error(e);
                    msg.channel.send('`' + e + '`');
                    return;
                }
            }
        } else {
            msg.channel.send(`You are not an admin, you can't do that`);
            return;
        }
    } else if (args[0] == "!gtv") {
            if (args[1] == 'dm' && msg.member.hasPermission('MANAGE_MESSAGES')) {
                console.log(msg.content);
                let memid = args[2];
                memid = memid.replace('>','');
                memid = memid.replace('!','');
                memid = memid.replace('<@','');
                let member = bot.users.cache.get(memid);
                let dm;
                try {
                    dm = await member.createDM();
                  } catch (error) {
                    console.error('cant create dm with user, someone mess up syntax????');
                    let feedback = new Discord.Message;
                    feedback.content = 'Cant find user';
                    msg.channel.send(feedback);
                    return false;
                }
                let msgWords = ogargs;
                let messagetosend = new Discord.Message;
                msgWords.splice(0,3);
                messagetosend.content = msgWords.join(' ');
                if (msg.attachments.array().length > 0) {
                    let attachments = msg.attachments.array();
                    for (i=0; i < attachments.length; i++) {
                        messagetosend.content = messagetosend.content + '\n' + attachments[i].url.toString();
                    } 
                }
                try {
                    dm.send(messagetosend);
                    msg.channel.send("Message Sent!");
                  } catch (error) {
                    console.log(error);
                    console.error('cant send DM');
                    msg.channel.send("Can't send DM");
                }
            }
            if (args[1] == 'msg' && msg.member.hasPermission('MANAGE_MESSAGES')) {
                let memid = args[2];
                memid = memid.replace('>','');
                memid = memid.replace('!','');
                memid = memid.replace('<#','');
                let channel;
                try {
                    channel = bot.channels.cache.get(memid);
                  } catch (error) {
                    console.error('cant create dm with user, someone mess up syntax????');
                    msg.channel.send("Can't find channel");
                    return;
                }
                let msgWords = ogargs;
                let messagetosend = new Discord.Message;
                msgWords.splice(0,3);
                messagetosend.content = msgWords.join(' ');
                if (msg.attachments.array().length > 0) {
                    let attachments = msg.attachments.array();
                    for (i=0; i < attachments.length; i++) {
                        messagetosend.content = messagetosend.content + '\n' + attachments[i].url.toString();
                    } 
                }
                try {
                    channel.send(messagetosend);
                    msg.channel.send("Message Sent!");
                  } catch (error) {
                    console.error('cant send message');
                    msg.channel.send("Can't send message");
                }
            }
            if (args[1] == 'embed' && msg.member.hasPermission('MANAGE_MESSAGES')) {
                embed(msg, args);
            }
            if (args[1] == 'help') {
                msg.channel.send(helpmsg);
            }
            if (args[1] == 'demographics') {
                msg.channel.send('Demographics has been moved to a slash command! Type /demographics');
            }
    } else if (args[0] == "!shutdown") {
        msg.channel.send('No.');
    }
});

async function embed(msg, args) {
    const filter = (msg) => msg.author.id != '';
    let embed = new Discord.MessageEmbed;
    let channelid = args[2];
    channelid = channelid.replace('>','');
    channelid = channelid.replace('<#','');
    await msg.channel.send('What do you want the embed title to be?');
    msg.channel.awaitMessages(filter, { max: 1})
        .then(collected => {
            embed.title = collected.first().content;
            msg.channel.send('What do you want as the description?');
            msg.channel.awaitMessages(filter, { max: 1})
                .then(collected => {
                    embed.description = collected.first().content;
                    let chann = bot.channels.cache.get(channelid);
                    chann.send(embed);
                    msg.channel.send('Embed Sent!');
                });
        });
}

async function checkfornewpost() {
    let channel = await bot.channels.fetch('');
    let lastcolor = store.data.lastpostcolor;
    let newcolor = await getnewcolor(lastcolor);
    gtvsub.getNew({limit: 2}).then(newpost => {
        if (newpost[0].title != store.data.lastposttitle) {
            if(newpost[0].title == store.data.secondposttitle) {
                store.set('lastposttitle', newpost[0].title);
                store.set('secondposttitle', newpost[1].title);
                return
            }
            if(store.data.lastpostcolor == 6) {
                store.set('lastpostcolor', 1);
            } else {
                store.set('lastpostcolor', store.data.lastpostcolor + 1);
            }
            store.set('lastposttitle', newpost[0].title);
            store.set('secondposttitle', newpost[1].title);
            let redditpostembed = new Discord.MessageEmbed;
            redditpostembed.title = newpost[0].title;
            redditpostembed.setFooter(`/u/${newpost[0].author.name}`);
            redditpostembed.color = newcolor;
            let link = 'https://reddit.com' + newpost[0].permalink;
            redditpostembed.setURL(link);
            if (newpost[0].post_hint == 'image') {
                redditpostembed.setThumbnail(newpost[0].url);
                redditpostembed.description = newpost[0].url;
            } else if (newpost[0].is_gallery == true) {
                let tempmsg;
                let imglink;
                let imgcaption;
                let imgcaptions = new Array;
                let imgids = new Array;
                for(i=0; i < newpost[0].gallery_data.items.length; i++) {
                    imgids.push(newpost[0].gallery_data.items[i].media_id);
                    imgcaptions.push(newpost[0].gallery_data.items[i].caption);
                }
                redditpostembed.setThumbnail(newpost[0].media_metadata[imgids[0]].s.u);
                for(i=0; i < imgids.length; i++) {
                    imglink = newpost[0].media_metadata[imgids[i]].s.u;
                    if (imgcaptions[i] == '' || imgcaptions[i] == undefined || imgcaptions[i] == null) {
                        imgcaption = ('Image ' + (i+1).toString());
                    } else {
                        imgcaption = imgcaptions[i];
                    }
                    tempmsg = ('[Link]' + '(' + imglink + ')');
                    redditpostembed.addField(imgcaption, tempmsg);
                }
            } else {
                redditpostembed.description = newpost[0].selftext;
            }
            redditpostembed.setTimestamp();
            channel.send(redditpostembed);
        }
    });
}

async function getnewcolor(lastcolor) {
    switch(lastcolor) {
        case 6: //this is up here since it technically shoots back the first color
            return('#E93233');
        case 1:
            return('#FFA131');
        case 2:
            return('#FFF033');
        case 3:
            return('#31974F');
        case 4:
            return('#316EFF');
        case 5:
            return('#8F379F');
    }
}

bot.login(config.credentials.discord);