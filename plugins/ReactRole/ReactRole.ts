import { GuildChannel, NewsChannel, Snowflake, TextChannel } from "discord.js";
import { Command, CommandTree, Handler, Plugin, RichEmbed, TreeTypes } from "../../Handler";
import { AbstractPluginData } from "../../Structures";

interface ReactRoleData extends AbstractPluginData {
    roles: {[emoji: string]: Snowflake | undefined},
    channel?: Snowflake,
    message: Snowflake[]
}

class ReactRole extends CommandTree<ReactRoleData> {
    
    constructor() {
        super("reactrole", ["gamerole"], "manage emoji -> role links.")
    }

    buildCommandTree(): void {
        this.then("list", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
            const parsedData  = [];
            for (const [key, value] of Object.entries(<{[key: string]: string}>data.roles)) {
                parsedData.push(`${guild.emojis.resolve(key)} -> ${guild.roles.resolve(value)}`);
            }
            Command.paginateData(channel, handler, new RichEmbed().setTitle("ReactRole: List"), parsedData);
        }).or("add")
            .then("emoji", {type: /<(a?:[^:+]:\d+)>\b|([^\s]+)\b/, argFilter: (arg, message): string => <string>(arg[1] ? arg[1] : arg[2])})
                .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const emoji = handler.emojis.resolveIdentifier(args.emoji);
                    const role = guild.roles.resolve(args.role);
                    if (emoji && role) {
                        const data = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                        data.roles[emoji] = role.id;
                        await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                        channel.send(new RichEmbed().setTitle("ReactRole: Add").setDescription(`Successfully added ${emoji.match(/a?:[^:+]:\d+/) ? `<${args.emoji}>` : args.emoji}`))
                    } else {
                        channel.send(new RichEmbed().setTitle("ReactRole: Add").setDescription(emoji ? `Unknown role: ${args.role}` : `Unknown emoji: ${args.emoji}`));
                    }
                }).or()
            .or()
        .or("del")
            .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const role = guild.roles.resolve(args.role);
                if (role) {
                    const data = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                    for (const [key, val] of Object.keys(data.roles)) {
                        if (val === role.id) {
                            data.roles[key] = undefined;
                            await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                            channel.send(new RichEmbed().setTitle("ReactRole: Delete").setDescription(`Successfully removed ${key} -> <@${val}>`));
                            break;
                        }
                    }
                } else {
                    channel.send(new RichEmbed().setTitle("ReactRole: Delete").setDescription(`Unknown role: ${args.role}`));
                }
            }).or("emoji", {type: /<(a?:[^:+]:\d+)>\b|([^\s]+)\b/, argFilter: (arg, message) => <string>(arg[1] ? arg[1] : arg[2])}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const emoji = handler.emojis.resolveIdentifier(args.emoji);
                if (emoji) {
                    const data = await handler.database.getGuildPluginData(<string>guild.id, this.plugin.name, this.plugin.data);
                    const val = data.roles[emoji];
                    data.roles[emoji] = undefined;
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                    channel.send(new RichEmbed().setTitle("ReactRole: Delete").setDescription(`Successfully removed ${emoji} -> <@${val}>`));
                } else {
                    channel.send(new RichEmbed().setTitle("ReactRole: Delete").setDescription(`Unknown emoji: ${args.emoji}`));
                }
            })
    }

}

class ReactRoleMessage extends CommandTree<ReactRoleData> {
    
    constructor() {
        super("reactrolemessage", ["gamerolemessage"], "manage messages for the reactions to be appended to.");
    }


    buildCommandTree(): void {
        this.then("list", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            const messages: string[] = [];
            const chnl = data.channel ? <TextChannel | NewsChannel>guild.channels.cache.get(data.channel) : channel;
            let i = 0;
            for (const message of data.message) {
                const msg = await chnl?.messages.fetch(message).catch(() => null);
                if (msg) {
                    messages.push(`${++i}. ${msg.url}`);
                } else {
                    messages.push(`${++i}. **ERROR** message id ${message} not found in <#${chnl}>`);
                }
            }
            Command.paginateData(channel, handler, new RichEmbed().setTitle("ReactRoleMessage: List").addField("Channel", chnl), messages);
        }).or("add", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            if (data.channel) {
                const chnl = guild.channels.resolve(data.channel);
                if (chnl === null) {
                    channel.send(new RichEmbed().setTitle("ReactRoleMessage: Add").setDescription("ERROR: Channel id does not correspond to an existing channel! did it get deleted? run `reactrolemessage clear` to fix.").setColor(0xFF0000));
                    return;
                }
                data.message.push((await (<TextChannel>chnl).send(new RichEmbed().setTitle("ReactRole").setDescription("React to recieve the corresponding role."))).id);
            } else {
                if (data.message.length) {
                    const chnl = await channel.messages.fetch(data.message[0]).catch(() => null) ?? channel;
                    if (chnl === null) {
                        channel.send(new RichEmbed().setTitle("ReactRoleMessage: Add").setDescription("ERROR: Database missing channel id, please send command in same channel as previous ReactRole messages or run `reactrolemessage clear`.").setColor(0xFF0000));
                        return;
                    }
                    data.channel = chnl.id;
                    data.message.push((await (<TextChannel>chnl).send(new RichEmbed().setTitle("ReactRole").setDescription("React to recieve the corresponding role."))).id);
                } else {
                    data.channel = channel.id;
                    data.message.push((await channel.send(new RichEmbed().setTitle("ReactRole").setDescription("React to recieve the corresponding role."))).id);
                }
            }
            handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
        })
            .then("messageURL", {type: /https:\/\/.+\.discord\.com\/channels\/\d+\/(\d+)\/(\d+)/, argFilter: (arg) => {return {channel: <string>arg[1], message: <string>arg[2]}}}, async (args, remainingContent, member, guild, channel, message, handler) => {
                args.messageURL
            }).or("channel", {type: TreeTypes.CHANNEL})
                .then("message", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    
                }).or()
            .or()
        .or("delete")
            .then("position", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                
            })
    }

}

class ReactRolePlugin extends Plugin<ReactRoleData> {
    registerExtraListeners(handler: Handler) {
        handler.on("messageReactionAdd", async (reaction, user) => {
            const guild = reaction.message.guild;
            if (guild != null) {
                const messageid = reaction.message.id;
                if ((await handler.database.getGuild(guild.id, handler.defaultPrefix)).enabled.includes(this.name)) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.name, this.data);
                    if (data.message.includes(messageid)) {
                        if (data.roles[reaction.emoji.identifier]) {
                            const member = guild.members.resolve(user.id);
                            member?.roles.add(<string>data.roles[reaction.emoji.identifier]);
                        }
                    }
                }
            }
        });
        handler.on("messageReactionRemove", async (reaction, user) => {
            const guild = reaction.message.guild;
            if (guild != null) {
                const messageid = reaction.message.id;
                if ((await handler.database.getGuild(guild.id, handler.defaultPrefix)).enabled.includes(this.name)) {
                    const data = await handler.database.getGuildPluginData(guild.id, this.name, this.data);
                    if (data.message.includes(messageid)) {
                        if (data.roles[reaction.emoji.identifier]) {
                            const member = guild.members.resolve(user.id);
                            member?.roles.remove(<string>data.roles[reaction.emoji.identifier]);
                        }
                    }
                }
            }
        });
    }
}

export const plugin = new ReactRolePlugin("ReactRole", "Gives users roles based on their reactions to a message.", {roles: {}, message: []});
plugin.addCommand(new ReactRole());
plugin.addCommand(new ReactRoleMessage());