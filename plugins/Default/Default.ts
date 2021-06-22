import { GuildMember, User, TextChannel, DMChannel, NewsChannel, Message, Guild } from "discord.js";
import { Command, CommandTree, Handler, Plugin, RichEmbed } from "../../Handler";
import { AbstractPluginData } from "../../Structures";

interface HelpData extends AbstractPluginData {}

class Help extends Command {
    constructor() {
        super("help", [], "help `command`", "helps with the usage of commands. \n`command` is optional and must be the actual command name not an alias.", true, true);
    }

    async message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): Promise<void> {
        const {enabled} = guild ? await handler.database.getGuild(guild.id, handler.defaultPrefix) : {enabled: handler.plugins.map(e => e.name)};
        if (content == null || content.match(/^ *$/) != null) {
            const reply = new RichEmbed()
                .setTitle("Help: ")
            const thumbnail = handler.user?.avatarURL();
            if (thumbnail) reply.setThumbnail(thumbnail);
            for (const plugin of handler.plugins) {
                if (enabled.includes(plugin.name)) {
                    reply.addField(plugin.name, plugin.commands.map(e => e.name).join('\n'), true);
                }
            }
            channel.send(reply);
        } else {
            content = content.toLowerCase().trim();
            for (const plugin of handler.plugins) {
                if (enabled.includes(plugin.name)) {
                    for (const command of plugin.commands) {
                        if (command.name === content) {
                            command.selfHelp(channel, guild, handler);
                            return;
                        }
                    }
                }
            }
            this.selfHelp(channel, guild, handler);
        }
    }
}

class Permissions extends CommandTree {
    constructor() {
        super("permissions", ["perms"], "permissions **list**\npermissions **add** `command` `<@role|roleid>`\npermissions **del** `command` `<@role|roleid>`\npermissions **reset** `command`", "change what roles are allowed to use commands.\n`command` is required and must be the command name, not an alias.");
    }

    buildCommandTree(): void {
        this.then("list", false, undefined, async (args, remainingContent, member, guild, channel, message, handler) => {
            const {enabled} = await handler.database.getGuild(<string>guild?.id, handler.defaultPrefix);
            const reply = new RichEmbed()
                .setTitle("Permissions: list")
                .setDescription("List of commands and what roles can use them.");
            for (const plugin of handler.plugins) {
                if (enabled.includes(plugin.name)) {
                    const commands: string[] = [];
                    const {perms} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild?.id, plugin.name, plugin.aliases, plugin.perms);
                    for (const command of plugin.commands) {
                        const roles: string[] = [];
                        for (const role of perms[command.name] ?? command.perms) {
                            if (role === "@everyone") {
                                roles.push(role);
                                continue;
                            }
                            let roleResolve = guild?.roles.resolve(role);
                            if (roleResolve) roles.push(roleResolve.toString());
                        }
                        commands.push(`**${command.name}:** ${roles.length ? roles.join(' ') : "none"}`);
                    }
                    reply.addField(plugin.name, commands.join('\n'));
                }
            }
            channel.send(reply);
        }).or("add")
            .then("command", false, /\w+/)
                .then("role", false, /[^\d]*?(\d+)|@everyone/, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const {enabled} = await handler.database.getGuild(<string>guild?.id, handler.defaultPrefix);
                    const reply = new RichEmbed()
                        .setTitle("Permissions: add");
                    let fail = true;
                    for (const plugin of handler.plugins) {
                        if (enabled.includes(plugin.name)) {
                            for (const command of plugin.commands) {
                                if (command.name === args.command[0]) {
                                    reply.setDescription(command.name);
                                    const {perms} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild?.id, plugin.name, plugin.aliases, plugin.perms);
                                    if (args.role[1] && guild?.roles.cache.has(args.role[1]) && args.role[1] !== guild.id && !perms[args.role[1]]?.includes(args.role[1])) {
                                        perms[command.name] = perms[command.name] ? perms[command.name]?.concat(args.role[1]) : [args.role[1]];
                                        handler.database.setGuildPluginPerms(guild.id, plugin.name, perms);
                                        reply.addField("Success", `Sucessfully added ${args.role[0]} to **${command.name}**.`);
                                    } else if (args.role[0] === '@everyone' || (args.role[1] === guild?.id)) {
                                        perms[command.name] = perms[command.name] ? perms[command.name]?.concat(["@everyone"]) : ["@everyone"];
                                        handler.database.setGuildPluginPerms(<string>guild?.id, plugin.name, perms);
                                        reply.addField("Success", `Sucessfully added @everyone to **${command.name}**.`);
                                    } else {
                                        reply.addField("Fail", "**role** did not parse, or is already there.");
                                    }
                                    fail = false;
                                }
                            }
                        }
                    }
                    if (fail) {
                        reply.addField("Fail", "**command** did not parse.");
                    }
                    channel.send(reply);
                }).or()
            .or()
        .or("del")
            .then("command", false, /\w+/)
                .then("role", false, /[^\d]*?(\d+)|@everyone/, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const {enabled} = await handler.database.getGuild(<string>guild?.id, handler.defaultPrefix);
                    const reply = new RichEmbed()
                        .setTitle("Permissions: add");
                    let fail = true;
                    for (const plugin of handler.plugins) {
                        if (enabled.includes(plugin.name)) {
                            for (const command of plugin.commands) {
                                if (command.name === args.command[0]) {
                                    reply.setDescription(command.name);
                                    const {perms} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild?.id, plugin.name, plugin.aliases, plugin.perms);
                                    if (args.role[1] && guild?.roles.cache.has(args.role[1]) && args.role[1] !== guild.id && !perms[args.role[1]]?.includes(args.role[1])) {
                                        perms[command.name] = perms[command.name] ? perms[command.name]?.filter(e => e !== args.role[1]) : [];
                                        handler.database.setGuildPluginPerms(guild.id, plugin.name, perms);
                                        reply.addField("Success", `Sucessfully added ${args.role[0]} to **${command.name}**.`);
                                    } else if (args.role[0] === '@everyone' || (args.role[1] === guild?.id)) {
                                        perms[command.name] = perms[command.name] ? perms[command.name]?.filter(e => e !== "@everyone") : [];
                                        handler.database.setGuildPluginPerms(<string>guild?.id, plugin.name, perms);
                                        reply.addField("Success", `Sucessfully added @everyone to **${command.name}**.`);
                                    } else {
                                        reply.addField("Fail", "**role** did not parse, or is already there.");
                                    }
                                    fail = false;
                                }
                            }
                        }
                    }
                    if (fail) {
                        reply.addField("Fail", "**command** did not parse.");
                    }
                    channel.send(reply);
                }).or()
            .or()
        .or("reset")
            .then("command", false, /\w+/, async (args, remainingContent, member, guild, channel, message, handler) => {
                const {enabled} = await handler.database.getGuild(<string>guild?.id, handler.defaultPrefix);
                const reply = new RichEmbed()
                    .setTitle("Permissions: del");
                let fail = true;
                for (const plugin of handler.plugins) {
                    if (enabled.includes(plugin.name)) {
                        for (const command of plugin.commands) {
                            if (command.name === args.command[0]) {
                                reply.setDescription(command.name);
                                const {perms} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild?.id, plugin.name, plugin.aliases, plugin.perms);
                                perms[command.name] = command.perms;
                                handler.database.setGuildPluginPerms(<string>guild?.id, plugin.name, perms);
                                fail = false;
                            }
                        }
                    }
                }
                if (fail) {
                    reply.addField("Fail", "**command** did not parse.");
                }
                channel.send(reply);

            }).or()
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            this.selfHelp(channel, guild, handler);
        });
    }

}

export const plugin = new Plugin<HelpData>("Default", "Default enabled stuff, don't disable", {});
plugin.addCommand(new Help());
plugin.addCommand(new Permissions());