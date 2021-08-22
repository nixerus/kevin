const fs = require('fs');
const Discord = require("discord.js");
const { Sequelize } = require('sequelize');
const config = require('./data/config.json')

const sequelize = new Sequelize(config.credentials.database.databaseName, config.credentials.database.username, config.credentials.database.password, {
	host: config.credentials.database.host,
	dialect: config.credentials.database.storage == "" ? "mysql" : "sqlite",
	logging: false,
	storage: config.credentials.database.storage == "" ? undefined : config.credentials.database.storage,
});

const suggestionsDB = sequelize.define('suggestionsDB', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      unique: false,
      primaryKey: true,
    },
    user_id: {
      type: Sequelize.STRING,
      unique: false,
    },
    suggestion_desc: {
      type: Sequelize.STRING,
      unique: false,
    },
    message_id: {
        type: Sequelize.STRING,
        unique: true,
    }
},{
    freezeTableName: true
});

suggestionsDB.sync();

async function newSuggestion(msg, channel) {
    return new Promise(async (resolve, reject) => {
        try {
            let data = JSON.parse(fs.readFileSync('./data/suggestiondata.json'));
            const webhooks = await channel.fetchWebhooks();
            const webhook = webhooks.first();
            await webhook.edit({
                name:msg.author.username,
                avatar:msg.author.avatarURL()
            });
            let suggestion = msg.content.replace(/[?]suggest /i, '');
            insertSuggestion(msg.author.id, suggestion).then(async (suggestionModel) => {
                let webhookMsg;
                if (msg.attachments.array().length > 0) {
                    let attachments = msg.attachments.array();
                    if (attachments[0].url.substring((attachments[0].url.length) - 3) == 'gif') {
                        webhookMsg = await webhook.send({
                            embeds: [{
                                description:suggestion,
                                color:'#FFA131',
                                footer:{text: `Suggestion #${suggestionModel.id}`},
                                image: {
                                    url: 'attachment://file.gif'
                                }
                            }],
                            files: [{
                                attachment: attachments[0].url,
                                name: 'file.gif'
                            }]
                        });
                    } else {
                        webhookMsg = await webhook.send({
                            embeds: [{
                                description:suggestion,
                                color:'#FFA131',
                                footer:{text: `Suggestion #${suggestionModel.id}`},
                                image: {
                                    url: 'attachment://file.jpg'
                                }
                            }],
                            files: [{
                                attachment: attachments[0].url,
                                name: 'file.jpg'
                            }]
                        });
                    }
                } else {
                    webhookMsg = await webhook.send({
                        embeds: [{
                            description:suggestion,
                            color:'#FFA131',
                            footer:{text: `Suggestion #${suggestionModel.id}`}
                        }]
                    });
                };
                suggestionsDB.update({ message_id: webhookMsg.id }, { where: { id: suggestionModel.id }}).then(async () => {
                    let returnMsg = new Discord.MessageEmbed;
                    returnMsg.description = `Your Suggestion has been sent to ${channel} to be voted on.`;
                    returnMsg.color = '#31974F';
                    returnMsg.setFooter(`Use ?deletesuggestion ${suggestionModel.id} to delete this suggestion.`);
                    resolve({message: returnMsg, suggestionMsg: webhookMsg, id: suggestionModel.id});
                })
            });
        } catch(e) {
            console.log(e);
            reject(e);
        }
    });
}

async function anonymousSuggestion(suggestion, channel) {
    return new Promise((resolve, reject) => {
        try {
            insertSuggestion(null, suggestion).then(async (suggestionModel) => {
                const webhooks = await channel.fetchWebhooks();
                const webhook = webhooks.first();
                await webhook.edit({
                    name:'Anonymous',
                    avatar:'link to bot avatar'
                });
                let webhookMsg = await webhook.send({
                    embeds: [{
                        description:suggestion,
                        color:'#FFA131',
                        footer:{text: `Suggestion #${suggestionModel.id}`}
                    }]
                });
                await suggestionsDB.update({ message_id: webhookMsg.id }, { where: { id: suggestionModel.id }});
                resolve({success: true});
            });
        } catch(e) {
            reject(e);
        }
    });
}

async function insertSuggestion(userId, suggestion) {
    return new Promise(async (resolve, reject) => {
        await suggestionsDB.create({
            user_id: userId,
            suggestion_desc: suggestion,
            message_id: "TBC"
        }).then((model) => {
            resolve(model);
        });
    });
}

async function deleteSuggestion(num, userid) {
    let suggestionEntry;
    suggestionEntry = await suggestionsDB.findOne({ where: { id: num }});
    try {
        suggestionEntry = await suggestionsDB.findOne({ where: { id: num }});
        if(suggestionEntry == null) {
            return({status: false, error:`Could not find suggestion #${suggestion = Discord.Util.removeMentions(num)}.`});
        }
        if (suggestionEntry.dataValues.user_id == userid || userid == 'MYUSERID') {
            await suggestionsDB.destroy({ id: num });
            return({status: true, message_id:suggestionEntry.dataValues.message_id, id:suggestionEntry.dataValues.id, desc:suggestionEntry.dataValues.suggestion_desc});
        } else {
            return({status: false, error:`You cannot delete a suggestion that you did not make!`});
        }
    } catch(e) {
        console.log(e);
        return({status: false, error:'`' + e + '`'});
    }
}

exports.deleteSuggestion = deleteSuggestion;
exports.newSuggestion = newSuggestion;
exports.anonymousSuggestion = anonymousSuggestion;