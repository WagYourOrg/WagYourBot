import { GuildMember, User, TextChannel, DMChannel, NewsChannel, Message, Guild } from "discord.js";
import { Command, CommandTree, Handler, Plugin, RichEmbed, TreeTypes } from "../../Handler";
import {WebPlugin} from "../../../web/WagYourBotWeb";

class Help extends CommandTree<DefaultData> {
    constructor() {
        super("help", [], "helps with the usage of commands. \n`command` is optional and must be the actual command name not an alias.", true, true);
    }
 
    buildCommandTree(): void {
        this.then("command", {type: TreeTypes.STRING}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const {enabled} = guild ? await handler.database.getGuild(guild.id, handler.defaultPrefix) : {enabled: handler.plugins.map(e => e.name)};
            for (const plugin of handler.plugins) {
                if (enabled.includes(plugin.name)) {
                    for (const command of plugin.commands) {
                        if (command.name === args.command?.toLowerCase()) {
                            command.selfHelp(channel, guild, handler);
                            return;
                        }
                    }
                }
            }
            channel.send(new RichEmbed().setTitle("Help: ERROR").setDescription(`Could not find command named \`${args.command?.toLowerCase()}\``).setColor(0xFF0000));
        })
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {  
            const {enabled} = guild ? await handler.database.getGuild(guild.id, handler.defaultPrefix) : {enabled: handler.plugins.map(e => e.name)};
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
        })
    }

}

class Permissions extends CommandTree<DefaultData> {

    constructor() {
        super("permissions", ["perms"], "change what roles are allowed to use commands.\n`command` is required and must be the command name, not an alias.");
    }

    buildCommandTree(): void {
        this.then("list", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
            const reply = new RichEmbed()
                .setTitle("Permissions: list")
                .setDescription("List of commands and what roles can use them.");
            for (const plugin of handler.plugins) {
                if (enabled.includes(plugin.name)) {
                    const commands: string[] = [];
                    const {perms} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild.id, plugin.name, plugin.aliases, plugin.perms);
                    for (const command of plugin.commands) {
                        const roles: string[] = [];
                        for (const role of perms[command.name] ?? command.perms) {
                            if (role === "@everyone" || role === "everyone") {
                                roles.push("@everyone");
                                continue;
                            }
                            let roleResolve = await guild.roles.fetch(role);
                            if (roleResolve) roles.push(roleResolve.toString());
                        }
                        commands.push(`**${command.name}:** ${roles.length ? roles.join(' ') : "none"}`);
                    }
                    reply.addField(plugin.name, commands.join('\n'));
                }
            }
            channel.send(reply);
        })
        .or("add")
            .then("command", {type: TreeTypes.STRING})
                .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                    const reply = new RichEmbed()
                        .setTitle("Permissions: add");
                    let fail = true;
                    for (const plugin of handler.plugins) {
                        if (enabled.includes(plugin.name)) {
                            for (const command of plugin.commands) {
                                if (command.name === args.command) {
                                    reply.setDescription(command.name);
                                    const {perms} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild.id, plugin.name, plugin.aliases, plugin.perms);
                                    let role = await guild.roles.fetch(<string>args.role);
                                    if (args.role !== '@everyone' && role && args.role !== guild.id && !perms[<string>args.role]?.includes(args.role)) {
                                        perms[command.name] = (perms[command.name] ?? command.perms).concat(args.role);
                                        handler.database.setGuildPluginPerms(guild.id, plugin.name, perms);
                                        reply.addField("Success", `Sucessfully added ${role} to **${command.name}**.`);
                                    } else if (args.role === '@everyone' || args.role === "everyone" || (args.role === guild.id)) {
                                        perms[command.name] = (perms[command.name] ?? command.perms).concat(["@everyone"]);
                                        handler.database.setGuildPluginPerms(<string>guild.id, plugin.name, perms);
                                        reply.addField("Success", `Sucessfully added @everyone to **${command.name}**.`);
                                    } else {
                                        reply.addField("Fail", `role \`${args.role}\` did not parse, or is already there.`);
                                    }
                                    fail = false;
                                }
                            }
                        }
                    }
                    if (fail) {
                        reply.addField("Fail", `did not find command \`${args.command}\``);
                    }
                    channel.send(reply);
                }).or()
            .or()
        .or("del")
            .then("command", {type: TreeTypes.STRING})
                .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                    const reply = new RichEmbed()
                        .setTitle("Permissions: del");
                    let fail = true;
                    for (const plugin of handler.plugins) {
                        if (enabled.includes(plugin.name)) {
                            for (const command of plugin.commands) {
                                if (command.name === args.command) {
                                    reply.setDescription(command.name);
                                    const {perms} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild.id, plugin.name, plugin.aliases, plugin.perms);
                                    if (args.role && guild.roles.cache.has(args.role) && args.role !== guild.id && !perms[args.role]?.includes(args.role)) {
                                        perms[command.name] = (perms[command.name] ?? command.perms).filter(e => e !== args.role);
                                        handler.database.setGuildPluginPerms(guild.id, plugin.name, perms);
                                        reply.addField("Success", `Sucessfully added ${args.role} to **${command.name}**.`);
                                    } else if (args.role === '@everyone' || (args.role === guild.id)) {
                                        perms[command.name] = (perms[command.name] ?? command.perms).filter(e => e !== "@everyone");
                                        handler.database.setGuildPluginPerms(<string>guild.id, plugin.name, perms);
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
            .then("command", {type: TreeTypes.STRING}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                const reply = new RichEmbed()
                    .setTitle("Permissions: reset");
                let fail = true;
                for (const plugin of handler.plugins) {
                    if (enabled.includes(plugin.name)) {
                        for (const command of plugin.commands) {
                            if (command.name === args.command) {
                                reply.setDescription(command.name);
                                const {perms} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild.id, plugin.name, plugin.aliases, plugin.perms);
                                perms[command.name] = command.perms;
                                handler.database.setGuildPluginPerms(<string>guild.id, plugin.name, perms);
                                fail = false;
                            }
                        }
                    }
                }
                if (fail) {
                    reply.addField("Fail", "**command** did not parse.");
                }
                channel.send(reply);
            })
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            this.selfHelp(channel, guild, handler);
        });
    }

}

class Aliases extends CommandTree<DefaultData> {

    constructor() {
        super("aliases", [], "change what aliases are assigned to use what commands\n **alias** is required and must not contain a space.\n**command** is required and must be the command name, not an alias.");
    }

    buildCommandTree(): void {
        this.then("list", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
            const reply = new RichEmbed()
                .setTitle("Aliases: list")
                .setDescription("List of commands and aliases for them.");
            for (const plugin of handler.plugins) {
                if(enabled.includes(plugin.name)) {
                    const {aliases} = (await handler.database.getGuildPluginAliasesAndPerms(<string>guild.id, plugin.name, plugin.aliases, plugin.perms));
                    const commands = [];
                    for (const command of plugin.commands) {
                        commands.push(`**${command.name}:** \`${aliases[command.name]?.length ? aliases[command.name]?.join("`, `") : (plugin.aliases.length ? command.aliases.join("`, `") : "none")}\``);
                    }
                    reply.addField(`**${plugin.name}**`, commands.join('\n'));
                }
            }
            channel.send(reply);
        })
        .or("add")
            .then("command", {type: TreeTypes.STRING})
                .then("alias", {type: TreeTypes.STRING}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                    const reply = new RichEmbed()
                        .setTitle("Aliases: add");
                    let fail = true;
                    for (const plugin of handler.plugins) {
                        if (enabled.includes(plugin.name)) {
                            for (const command of plugin.commands) {
                                if (command.name === args.command) {
                                    reply.setDescription(command.name);
                                    const {aliases} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild.id, plugin.name, plugin.aliases, plugin.perms);
                                    if (args.alias && !(aliases[command.name] ?? command.aliases).includes(args.alias)) {
                                        aliases[command.name] =(aliases[command.name] ?? command.aliases).concat(args.alias);
                                        handler.database.setGuildPluginAliases(<string>guild.id, plugin.name, aliases);
                                        reply.addField("Success", `Sucessfully added \`${args.alias}\` to **${command.name}**.`);
                                    } else {
                                        reply.addField("Fail", `**alias** didn't parse, or already exists.`);
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
            .then("command", {type: TreeTypes.STRING})
                .then("alias", {type: TreeTypes.STRING}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                    const reply = new RichEmbed()
                        .setTitle("Aliases: del");
                    let fail = true;
                    for (const plugin of handler.plugins) {
                        if (enabled.includes(plugin.name)) {
                            for (const command of plugin.commands) {
                                if (command.name === args.command) {
                                    reply.setDescription(command.name);
                                    const {aliases} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild.id, plugin.name, plugin.aliases, plugin.perms);
                                    if (args.alias && (aliases[command.name] ?? command.aliases).includes(args.alias)) {
                                        aliases[command.name] = (aliases[command.name] ?? command.aliases).filter(e => e != args.alias);
                                        handler.database.setGuildPluginAliases(<string>guild.id, plugin.name, aliases);
                                        reply.addField("Success", `Sucessfully removed \`${args.alias}\` from **${command.name}**.`, false);
                                    } else {
                                        reply.addField("Fail", `**alias** didn't parse, or already exists.`, false);
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
            .then("command", {type: TreeTypes.STRING}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                const reply = new RichEmbed()
                    .setTitle("Aliases: reset");
                let fail = true;
                for (const plugin of handler.plugins) {
                    if (enabled.includes(plugin.name)) {
                        for (const command of plugin.commands) {
                            if (command.name === args.command) {
                                reply.setDescription(command.name);
                                const {aliases} = await handler.database.getGuildPluginAliasesAndPerms(<string>guild.id, plugin.name, plugin.aliases, plugin.perms);
                                aliases[command.name] = command.perms;
                                handler.database.setGuildPluginAliases(<string>guild.id, plugin.name, aliases);
                                fail = false;
                            }
                        }
                    }
                }
                if (fail) {
                    reply.addField("Fail", "**command** did not parse.");
                }
                channel.send(reply);
            })
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            this.selfHelp(channel, guild, handler);
        })
    }
    
}

class SetPrefix extends Command<DefaultData> {

    constructor() {
        super("setprefix", [], "setprefix **prefix**", "sets prefix for the server.\n**prefix** must not contain a space.");
    }

    async message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): Promise<void> {
        const parts = content.split(' ');
        const reply = new RichEmbed()
            .setTitle("SetPrefix: ");
        if (parts[0] && parts[0].length < 10 && parts[0].length > 0) {
            handler.database.setGuildPrefix(<string>guild?.id, parts[0]);
            reply.setDescription(`Prefix sucessfully set to \`${parts[0]}\``);
        } else {
            reply.setDescription("Failed, **prefix** could not be parsed");
        }
        channel.send(reply);
    }

}

class Plugins extends CommandTree<DefaultData> {
    constructor() {
        super("plugins", [], "enables/disables plugin components.\n**plugin** is required and must be the name of the plugin.")
    }

    buildCommandTree(): void {
        this.then("list", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
            const plugins = handler.plugins.map(e => e.name);
            const reply = new RichEmbed()
                .setTitle("Plugins: list");
            const enable = plugins.filter(e => enabled.includes(e)).join("\n");
            const disable = plugins.filter(e => !enabled.includes(e)).join("\n");
            if (enable.length) reply.addField("Enabled", enable);
            if (disable.length) reply.addField("Disabled", disable);
            channel.send(reply);
        })
        .or("info")
            .then("plugin", {type: TreeTypes.STRING}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                const reply = new RichEmbed()
                    .setTitle("Plugins: info");
                const result = handler.plugins.filter(e => e.name.toLowerCase() === args.plugin?.toLowerCase())[0];
                if (result) {
                    reply.setDescription(`${enabled.includes(result.name) ? "Enabled" : "Disabled"}`);
                    reply.addField(result.name, result.description);
                } else {
                    reply.addField("Failed", "**Plugin** failed to parse.");
                }
                channel.send(reply);
        }).or()
        .or("enable")
            .then("plugin",{type: TreeTypes.STRING}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                const reply = new RichEmbed()
                    .setTitle("Plugins: enable");
                const result = handler.plugins.filter(e => e.name.toLowerCase() == args.plugin?.toLowerCase());
                if (result.length && !enabled.includes(result[0].name)) {
                    reply.setDescription(result[0].name);
                    handler.database.setGuildEnabled(<string>guild.id, enabled.concat(result[0].name));
                } else {
                    reply.addField("Failed", "**Plugin** failed to parse or is already enabled.");
                }
                channel.send(reply);

            }).or()
        .or("disable")
            .then("plugin", {type: TreeTypes.STRING}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const {enabled} = await handler.database.getGuild(<string>guild.id, handler.defaultPrefix);
                const reply = new RichEmbed()
                    .setTitle("Plugins: disable");
                const result = handler.plugins.filter(e => e.name.toLowerCase() == args.plugin?.toLowerCase());
                if (result.length && !enabled.includes(result[0].name)) {
                    reply.setDescription(result[0].name);
                    handler.database.setGuildEnabled(<string>guild.id, enabled.filter(e =>e !== result[0].name));
                } else {
                    reply.addField("Failed", "**Plugin** failed to parse or is already disabled.");
                }
                channel.send(reply);
            })
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            this.selfHelp(channel, guild, handler);
        });
    }
    
}

export const plugin = new WebPlugin<DefaultData>("Default", "Default enabled stuff, don't disable", {});
plugin.addCommand(new Help());
plugin.addCommand(new Permissions());
plugin.addCommand(new Aliases());
plugin.addCommand(new SetPrefix());
plugin.addCommand(new Plugins());