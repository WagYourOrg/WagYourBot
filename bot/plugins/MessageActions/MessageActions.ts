import { WebPlugin } from "../../../web/WagYourBotWeb";
import {
    GiveRoleData,
    MessageActionData,
    MessageActionsData,
    MessageActionTypes,
    ResponseData,
    TakeRoleData
} from "./MessageActionscommon";
import { Command, CommandTree, Handler, RichEmbed, Tree, TreeTypes } from "../../Handler";
import { DMChannel, Message, MessageReaction, NewsChannel, Role, TextChannel } from "discord.js";
import { response } from "express";


class InternalMessageAction extends CommandTree<MessageActionsData> {
    readonly respond = new InternalEmbedData();
    remaining!: MessageActionTypes;

    constructor(remaining: number & MessageActionTypes = MessageActionTypes.AddDeleteReaction | MessageActionTypes.Give_Role | MessageActionTypes.Take_Role | MessageActionTypes.Respond) {
        //@ts-ignore
        super("do", [], remaining);
        (<{usage:string}>this).usage += "\n\n`<response_data>`:\n " + this.respond.usage;
    }

    private static addDeleteReaction(message: {message_actions_smuggled_data: MessageActionData | undefined}): boolean {
        const data = message.message_actions_smuggled_data;
        if (data) {
            data.types |= MessageActionTypes.AddDeleteReaction;
        } else {
            message.message_actions_smuggled_data = {
                regex: "",
                types: MessageActionTypes.AddDeleteReaction,
                data: {}
            };
        }
        return true;
    }

    private static addRole(message: {message_actions_smuggled_data: MessageActionData | undefined}, role: Role | null): boolean {
        if (role) {
            const data = message.message_actions_smuggled_data;
            if (data) {
                data.types |= MessageActionTypes.Give_Role;
                (<GiveRoleData>data.data).give = role.id;
            } else {
                message.message_actions_smuggled_data = {
                    regex: "",
                    types: MessageActionTypes.Give_Role,
                    data: {give: role.id}
                };
            }
            return true;
        }
        return false;
    }

    private static removeRole(message: {message_actions_smuggled_data: MessageActionData | undefined}, role: Role | null): boolean {
        if (role) {
            const data = message.message_actions_smuggled_data;
            if (data) {
                data.types |= MessageActionTypes.Take_Role;
                (<TakeRoleData>data.data).take = role.id;
            } else {
                message.message_actions_smuggled_data = {
                    regex: "",
                    types: MessageActionTypes.Take_Role,
                    data: {take: role.id}
                };
            }
            return true;
        }
        return false;
    }

    async sendError(error: string, message: { channel: TextChannel | DMChannel | NewsChannel }): Promise<Message> {
        (<{message_actions_smuggled_data: Error}><unknown>message).message_actions_smuggled_data = new Error(error);
        //@ts-ignore
        return null;
    }


    buildCommandTree(): void {
        //@ts-ignore
        this.remaining = this.description;
        (<{description: string}>this).description = "";
        if (this.remaining & MessageActionTypes.AddDeleteReaction) {
            const afterDeleteReaction = this.remaining ^ MessageActionTypes.AddDeleteReaction;
            this.then("deletereaction", {},async (args, remainingContent, member, guild, channel, message, handler) => {
                if (!InternalMessageAction.addDeleteReaction(<{ message_actions_smuggled_data: MessageActionData | undefined }><unknown>message)) {
                    this.sendError(`failed to add delete reaction`, message);
                }
            })
            if (afterDeleteReaction) {
                const nextAction = new InternalMessageAction(afterDeleteReaction);
                this.then("next_action?", {type: /do (.+)/, argFilter: (arg) => <string>arg[1]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!InternalMessageAction.addDeleteReaction(<{ message_actions_smuggled_data: MessageActionData | undefined }><unknown>message)) {
                        this.sendError(`failed to add delete reaction`, message);
                        return;
                    }
                    await nextAction.message(args["next_action?"], member, guild, channel, message, handler);
                }).or()
            }
            this.or()
        }
        if (this.remaining & MessageActionTypes.Give_Role) {
            const afterGiveRole = this.remaining ^ MessageActionTypes.Give_Role;
            this.then("giverole")
                .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!InternalMessageAction.addRole(<{ message_actions_smuggled_data: MessageActionData | undefined }><unknown>message, await guild.roles.fetch(args.role))) {
                        this.sendError(`failed to set giverole to input \`${args.role}\``, message);
                    }
                })
                if (afterGiveRole) {
                    const nextAction = new InternalMessageAction(afterGiveRole);
                    (<Tree<{role: string}, any, {}>><unknown>this).then("next_action?", {type: /do (.+)/, argFilter: (arg) => <string>arg[1]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                        if (!InternalMessageAction.addRole(<{ message_actions_smuggled_data: MessageActionData | undefined }><unknown>message, await guild.roles.fetch(args.role))) {
                            this.sendError(`failed to set giverole to input \`${args.role}\``, message);
                            return;
                        }
                        await nextAction.message(args["next_action?"], member, guild, channel, message, handler);
                    }).or()
                }
                this.or()
            this.or()
        }
        if (this.remaining & MessageActionTypes.Take_Role) {
            const afterTakeRole = this.remaining ^ MessageActionTypes.Take_Role;
            this.then("takerole")
                .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    if (!InternalMessageAction.removeRole(<{ message_actions_smuggled_data: MessageActionData | undefined }><unknown>message, await guild.roles.fetch(args.role))) {
                        this.sendError(`failed to set takerole to input \`${args.role}\``, message);
                    }
                })
                if (afterTakeRole) {
                    const nextAction = new InternalMessageAction(afterTakeRole);
                    (<Tree<{role: string}, any, {}>><unknown>this).then("next_action?", {type: /do (.+)/, argFilter: (arg) => <string>arg[1]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                        if (!InternalMessageAction.removeRole(<{ message_actions_smuggled_data: MessageActionData | undefined }><unknown>message, await guild.roles.fetch(args.role))) {
                            (<{message_actions_smuggled_data: Error}><unknown>message).message_actions_smuggled_data = new Error(`failed to set takerole to input \`${args.role}\``);
                            return;
                        }
                        await this.message(args["next_action?"], member, guild, channel, message, handler);
                    }).or()
                }
                this.or()
            this.or()
        }
        if (this.remaining & MessageActionTypes.Respond) {
            this.then("respond").then("response_data", {type: /.+/m, argFilter: (arg) => <string>arg[0]}, async (
                args, remainingContent, member, guild, channel, message, handler) => {
                await this.respond.message(args.response_data, member, guild, channel, message, handler);
                const data = (<{ smuggled_embed_data: ResponseData | undefined | Error }><unknown>message).smuggled_embed_data;
                if (data && data instanceof Error) {
                    this.sendError(data.message, message);
                } else if (data) {
                    const msgData = (<{ message_actions_smuggled_data: MessageActionData | undefined }><unknown>message).message_actions_smuggled_data;
                    if (msgData) {
                        msgData.types |= MessageActionTypes.Respond;
                        msgData.data = Object.assign(msgData.data, data);
                    } else {
                        (<{ message_actions_smuggled_data: MessageActionData | undefined }><unknown>message).message_actions_smuggled_data = {
                            regex: "",
                            types: MessageActionTypes.Respond,
                            data: data
                        };
                    }
                } else {
                    this.sendError("did not recieve/parse response data", message);
                }
            })
        }
    }
}

class MessageAction extends CommandTree<MessageActionsData> {
    private internal_action = new InternalMessageAction(0xF);

    constructor() {
        super("messageaction", ["action"], "Set actions on certain messages.");
        (<{usage:string}>this).usage += "\n\n`<actions>`:\n " + this.internal_action.usage;
    }

    static buildActionFromData(data: MessageActionData, embed: RichEmbed): RichEmbed {
        if (data.types & MessageActionTypes.AddDeleteReaction) {
            embed.addField("Delete Reaction", "true");
        }
        if (data.types & MessageActionTypes.Give_Role) {
            //@ts-ignore
            embed.addField("Give Role", `<@&${data.data.give}>`);
        }
        if (data.types & MessageActionTypes.Take_Role) {
            //@ts-ignore
            embed.addField("Take Role", `<@&${data.data.take}>`);
        }
        if (data.types & MessageActionTypes.Respond) {
            embed.addField("Response", `response data not rendered`);
        }
        return embed;
    }

    buildCommandTree(): void {
        this.then("list", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            const lines: string[] = [];
            let count = 0;
            for (const action of data.actions) {
                let types = [];
                if (action.types & MessageActionTypes.AddDeleteReaction) {
                    types.push("`Delete Reaction`");
                }
                if (action.types & MessageActionTypes.Give_Role) {
                    types.push("`Give Role`");
                }
                if (action.types & MessageActionTypes.Take_Role) {
                    types.push("`Take Role`")
                }
                if (action.types & MessageActionTypes.Respond) {
                    types.push("`Respond`")
                }
                lines.push(`**${++count}.** \`/${action.regex}/gi\` - ${types.join(" ")}`);
            }
            Command.paginateData(channel, handler, new RichEmbed().setTitle("Message Actions: List"), lines);
        })
        .or("add")
            .then("match", {type: /(\/|`)(.*)\1/, argFilter: (arg) => <string>arg[2]})
                .then("actions", {type: /do (.+)/, argFilter: (arg) => <string>arg[1]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    await this.internal_action.message(args.actions, member, guild, channel, message, handler);
                    const action_data = (<{message_actions_smuggled_data: MessageActionData | undefined | Error}><unknown>message).message_actions_smuggled_data;
                    if (action_data instanceof Error) {
                        this.sendError(action_data.message, message);
                    } else if (action_data) {
                        action_data.regex = args.match
                        const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                        data.actions.push(action_data);
                        await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                        channel.send(MessageAction.buildActionFromData(action_data, new RichEmbed().setTitle("Message Actions").setDescription(`Added Action for regex: \`${action_data.regex}\``)));
                        (<MessageActionsPlugin>this.plugin).compiled_guild_data[guild.id] = undefined;
                    } else {
                        this.sendError("did not recieve/parse action data", message);
                    }
                }).or()
            .or()
        .or("show")
            .then("position", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                const position = parseInt(args.position) - 1;
                if (position < 0 || position >= data.actions.length) {
                    channel.send(new RichEmbed().setTitle("Message Actions: Show").setDescription(`Position, ${position}, out of range. max: ${data.actions.length}`));
                    return;
                }
                channel.send(MessageAction.buildActionFromData(data.actions[position], new RichEmbed().setTitle("Message Actions: Show").setDescription(`Position: ${position + 1}, regex: \`/${data.actions[position].regex}/gi\``)));
            }).or("response")
                .then("position", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const position = parseInt(args.position) - 1;
                    if (position < 0 || position >= data.actions.length) {
                        channel.send(new RichEmbed().setTitle("Message Actions: Show").setDescription(`Position, ${position}, out of range. max: ${data.actions.length}`));
                        return;
                    }
                    const action = data.actions[position];
                    if (action.types & MessageActionTypes.Respond) {
                        SendEmbed.sendResponse(<ResponseData>action.data, channel);
                    } else {
                        channel.send(new RichEmbed().setTitle("Message Actions: Show Response").setDescription(`action #${position + 1} does now have a response.`));
                    }
                }).or()
            .or()
        .or("delete")
            .then("position", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                const position = parseInt(args.position) - 1;
                if (position < 0 || position >= data.actions.length) {
                    channel.send(new RichEmbed().setTitle("Message Actions: Delete").setDescription(`Position, ${position}, out of range. max: ${data.actions.length}`));
                    return;
                }
                const deleted = data.actions.splice(position, 1)[0];
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                channel.send(MessageAction.buildActionFromData(deleted, new RichEmbed().setTitle("Message Actions: Delete").setDescription(`Deleted position ${position + 1} with regex \`/${deleted.regex}/gi\``)));
                (<MessageActionsPlugin>this.plugin).compiled_guild_data[guild.id] = undefined;
            }).or()
        .or("modify")
            .then("position", {type: TreeTypes.INTEGER})
                .then("regex", {type: /(\/|`)(.*)\1/, argFilter: (arg) => <string>arg[2]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const position = parseInt(args.position) - 1;
                    if (position < 0 || position >= data.actions.length) {
                        channel.send(new RichEmbed().setTitle("Message Actions: Delete").setDescription(`Position, ${position}, out of range. max: ${data.actions.length}`));
                        return;
                    }
                    const oldRegex = data.actions[position].regex;
                    data.actions[position].regex = args.regex;
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                    channel.send(new RichEmbed().setTitle(`Message Action: Modify`).setDescription(`changed regex in position ${position + 1},\n\`/${oldRegex}/gi\` -> \`/${args.regex}/gi\``));
                    (<MessageActionsPlugin>this.plugin).compiled_guild_data[guild.id] = undefined;
                })
                .or("remove")
                    .then("action_name", {type: /deletereaction|giverole|takerole|respond/, argFilter: (arg) => <string>arg[0]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                        const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                        const position = parseInt(args.position) - 1;
                        if (position < 0 || position >= data.actions.length) {
                            channel.send(new RichEmbed().setTitle("Message Actions: Delete").setDescription(`Position, ${position}, out of range. max: ${data.actions.length}`));
                            return;
                        }
                        switch (args.action_name) {
                            case "deletereaction": {
                                data.actions[position].types -= data.actions[position].types & MessageActionTypes.AddDeleteReaction;
                                break;
                            }
                            case "giverole": {
                                data.actions[position].types -= data.actions[position].types & MessageActionTypes.Give_Role;
                                //@ts-ignore
                                data.actions[position].data.give = undefined;
                                break;
                            }
                            case "takerole": {
                                data.actions[position].types -= data.actions[position].types & MessageActionTypes.Take_Role;
                                //@ts-ignore
                                data.actions[position].data.take = undefined;
                                break;
                            }
                            case "respond": {
                                data.actions[position].types -= data.actions[position].types & MessageActionTypes.Respond;
                                //@ts-ignore
                                data.actions[position].data.title = undefined;
                                //@ts-ignore
                                data.actions[position].data.description = undefined;
                                //@ts-ignore
                                data.actions[position].data.field = undefined;
                                //@ts-ignore
                                data.actions[position].data.image = undefined;
                                //@ts-ignore
                                data.actions[position].data.deleteReaction = undefined;
                                break;
                            }
                        }
                        await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                        channel.send(MessageAction.buildActionFromData(data.actions[position], new RichEmbed().setTitle("Message Actions: Removed").setDescription(`removed \`${args.action_name}\` to position ${position + 1} with regex \`/${data.actions[position].regex}/gi\``)));
                        (<MessageActionsPlugin>this.plugin).compiled_guild_data[guild.id] = undefined;
                    })
                    .or()
                .or("add")
                    .then("actions", {type: /do (.+)/, argFilter: (arg) => <string>arg[1]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                        const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                        const position = parseInt(args.position) - 1;
                        if (position < 0 || position >= data.actions.length) {
                            channel.send(new RichEmbed().setTitle("Message Actions: Delete").setDescription(`Position, ${position}, out of range. max: ${data.actions.length}`));
                            return;
                        }
                        await this.internal_action.message(args.actions, member, guild, channel, message, handler);
                        const newData = (<{message_actions_smuggled_data: MessageActionData | undefined | Error}><unknown>message).message_actions_smuggled_data;
                        if (newData instanceof Error) {
                            this.sendError(newData.message, message);
                        } else if (newData) {
                            data.actions[position].types |= newData.types;
                            data.actions[position].data = Object.assign(data.actions[position].data, newData.data);
                        }
                        await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                        channel.send(MessageAction.buildActionFromData(data.actions[position], new RichEmbed().setTitle("Message Actions: ADD").setDescription(`Added to position ${position + 1} with regex \`/${data.actions[position].regex}/gi\``)));
                        (<MessageActionsPlugin>this.plugin).compiled_guild_data[guild.id] = undefined;
                    })
    }
}

class InternalEmbedData extends CommandTree<MessageActionsData> {
    constructor() {
        super("", [], "");

    }

    async sendError(error: string, message: { channel: TextChannel | DMChannel | NewsChannel }): Promise<Message> {
        (<{smuggled_embed_data: Error}><unknown>message).smuggled_embed_data = new Error(error);
        //@ts-ignore
        return null;
    }

    private static setTitle(content: string, message: {smuggled_embed_data: ResponseData | undefined}): Error | undefined {
        const data = message.smuggled_embed_data;
        if (content.trim().length == 0) {
            return new Error("Title cannot be empty");
        }
        if (data) {
            data.title = content.trim();
        } else {
            message.smuggled_embed_data = {
                title: content.trim(),
                field: [],
                deleteReaction: false
            };
        }
        return;
    }

    private static setDescription(content: string, message: {smuggled_embed_data: ResponseData | undefined}): Error | undefined {
        const data = message.smuggled_embed_data;
        if (content.trim().length == 0) {
            return new Error("Description cannot be empty");
        }
        if (data) {
            data.description = content.trim();
        } else {
            message.smuggled_embed_data = {
                description: content.trim(),
                field: [],
                deleteReaction: false
            };
        }
        return;
    }

    private static addField(title: string, content: string, inline: boolean, message: {smuggled_embed_data: ResponseData | undefined}): Error | undefined {
        const data = message.smuggled_embed_data;
        if (title.trim().length == 0) {
            return new Error("Field title cannot be empty");
        }
        if (content.trim().length == 0) {
            return new Error("Field content cannot be empty");
        }
        if (data) {
            data.field.push({title: title, body: content, inline: inline});
        } else {
            message.smuggled_embed_data = {
                field: [{title: title, body: content, inline: inline}],
                deleteReaction: false
            };
        }
        return;
    }

    private static deleteReaction(message: {smuggled_embed_data: ResponseData | undefined}): Error | undefined {
        const data = message.smuggled_embed_data;
        if (data) {
            data.deleteReaction = !data.deleteReaction;
        } else {
            message.smuggled_embed_data = {
                field: [],
                deleteReaction: true
            };
        }
        return;
    }

    buildCommandTree(): void {
        this.then("--title")
            .then("contents", {type: /.+?( --)?/, lookahead: true}, async (args, remainingContent, member, guild, channel, message, handler) => {
                InternalEmbedData.setTitle(args.contents, <{smuggled_embed_data: ResponseData | undefined}><unknown>message)
            })
                .then("next_arg?", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    InternalEmbedData.setTitle(args.contents, <{smuggled_embed_data: ResponseData | undefined}><unknown>message)
                    await this.message(args["next_arg?"], member, guild, channel, message, handler);
                }).or()
            .or()
        .or("--description")
            .then("contents", {type: /.+?( --)?/, lookahead: true}, async (args, remainingContent, member, guild, channel, message, handler) => {
                InternalEmbedData.setDescription(args.contents, <{smuggled_embed_data: ResponseData | undefined}><unknown>message)
            })
                .then("next_arg?", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    InternalEmbedData.setDescription(args.contents, <{smuggled_embed_data: ResponseData | undefined}><unknown>message)
                    await this.message(args["next_arg?"], member, guild, channel, message, handler);
                }).or()
            .or()
        .or("--fieldTitle")
            .then("titleContents", {type: /(.+?)( --fieldDescription)?/, argFilter: (arg) => <string>arg[1], lookahead: true})
                .then("--fieldDescription")
                    .then("descContents", {type: /.+?( --)?/, lookahead: true}, async (args, remainingContent, member, guild, channel, message, handler) => {
                        InternalEmbedData.addField(args.titleContents, args.descContents, false, <{smuggled_embed_data: ResponseData | undefined}><unknown>message)
                    }).then("--inline", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
                            InternalEmbedData.addField(args.titleContents, args.descContents, true, <{smuggled_embed_data: ResponseData | undefined}><unknown>message)
                        })
                            .then("next_arg?", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                                InternalEmbedData.addField(args.titleContents, args.descContents, true, <{smuggled_embed_data: ResponseData | undefined}><unknown>message)
                                await this.message(args["next_arg?"], member, guild, channel, message, handler);
                            }).or()
                        .or("next_arg?", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                            InternalEmbedData.addField(args.titleContents, args.descContents, false, <{smuggled_embed_data: ResponseData | undefined}><unknown>message)
                            await this.message(args["next_arg?"], member, guild, channel, message, handler);
                        }).or()
                    .or()
                .or()
            .or()
        .or("--deleteReaction", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            InternalEmbedData.deleteReaction(<{smuggled_embed_data: ResponseData | undefined}><unknown>message);
        })
            .then("next_arg?", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
                InternalEmbedData.deleteReaction(<{smuggled_embed_data: ResponseData | undefined}><unknown>message);
                await this.message(args["next_arg?"], member, guild, channel, message, handler);
            })
    }

}

class SendEmbed extends CommandTree<MessageActionsData> {
    readonly internal_embed = new InternalEmbedData();

    constructor() {
        super("sendembed", [], "send an embed in the current channel");
        (<{usage:string}>this).usage += "\n\n`<EmbedData>`:\n " + this.internal_embed.usage;
    }

    static async sendResponse(data: ResponseData, channel: TextChannel | NewsChannel): Promise<Message> {
        const embed = new RichEmbed()
        if (data.title) {
            embed.setTitle(data.title);
        }
        if (data.description) {
            embed.setDescription(data.description);
        }
        if (data.image) {
            embed.setImage(data.image);
        }
        for (const field of data.field) {
            embed.addField(field.title, field.body, field.inline);
        }
        const message = await channel.send(embed);
        if (data.deleteReaction) {
            MessageActionsPlugin.doDeleteReaction(message);
        }
        return message;
    }

    buildCommandTree(): void {
        this.then("EmbedData", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
            await this.internal_embed.message(args.EmbedData, member, guild, channel, message, handler);
            const data = (<{smuggled_embed_data: ResponseData | undefined | Error}><unknown>message).smuggled_embed_data;
            if (data instanceof Error) {
                this.sendError(data.message, message);
            } else if (data) {
                SendEmbed.sendResponse(data, channel);
            }
        })
    }

}

class MessageActionsPlugin extends WebPlugin<MessageActionsData> {
    readonly compiled_guild_data: {[guild: string]: (MessageActionData & {compiledRegex: RegExp})[] | undefined} = {};

    private compileGuildData(guild_id: string, data: MessageActionsData) {
        const compiled_actions: (MessageActionData & {compiledRegex: RegExp})[] = [];
        for (const action of data.actions) {
            compiled_actions.push(Object.assign(action, {compiledRegex: new RegExp(action.regex, "gi")}));
        }
        this.compiled_guild_data[guild_id] = compiled_actions;
    }

    private static doAction(action: MessageActionData, message: Message) {
        if (action.types & MessageActionTypes.Respond) {
            SendEmbed.sendResponse(<ResponseData>action.data, <TextChannel>message.channel);
        }
        if (action.types & MessageActionTypes.Give_Role) {
            message.member?.roles.add((<GiveRoleData>action.data).give);
        }
        if (action.types & MessageActionTypes.Take_Role) {
            message.member?.roles.remove((<TakeRoleData>action.data).take);
        }
        if (action.types & MessageActionTypes.AddDeleteReaction) {
            MessageActionsPlugin.doDeleteReaction(message);
        }
    }

    static async doDeleteReaction(message: Message) {
        await message.react("🗑️");
        let reaction: MessageReaction | null = [...(await message.awaitReactions((reaction) => "🗑️" === reaction.emoji.name, {idle: 60000, max:1})).values()][0]
        if (reaction) {
            await message.delete({reason: "Delete Reaction"});
        }
    }

    async onMessage(message: Message, handler: Handler): Promise<void> {
        try {
            if (message.guild) {
                if (!this.compiled_guild_data[message.guild.id]) {
                    const data = await handler.database.getGuildPluginData(message.guild.id, this.name, this.data);
                    this.compileGuildData(message.guild.id, data);
                }
                const guildData = <(MessageActionData & { compiledRegex: RegExp })[]>this.compiled_guild_data[message.guild.id];
                for (const action of guildData) {
                    if (message.content.match(action.compiledRegex)) {
                        MessageActionsPlugin.doAction(action, message);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}

export const plugin = new MessageActionsPlugin("MessageActions", "Preforms certain actions on matched messages", { actions: [] });
plugin.addCommand(new MessageAction());
plugin.addCommand(new SendEmbed());