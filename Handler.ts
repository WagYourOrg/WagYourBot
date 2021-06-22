import { MessageEmbedOptions, NewsChannel } from "discord.js";
import { Client as BaseClient, Collection, DiscordAPIError, DMChannel, Emoji, Guild, GuildMember, Message, MessageEmbed, TextChannel, User } from "discord.js";
import { SQLDatabase } from "./Database";
import { PluginAliases, PluginPerms, Database, PluginSlug, AbstractPluginData } from "./Structures";


export abstract class Handler extends BaseClient {
    readonly defaultPrefix;
    readonly database: Database;
    readonly plugins: Plugin<any>[] = [];
    readonly owner = "100748674849579008";

    constructor(defaultPrefix: string) {
        super();
        this.defaultPrefix = defaultPrefix;
        this.registerPlugins();
        this.database = new SQLDatabase(this.plugins.map(e => e.name));

        this.on("message", this.onMessage);
    }

    abstract registerPlugins(): void;

    async onMessage(message: Message) {
        const guildID = message.guild?.id;
        let content = message.content;
        if (guildID) {
            const {prefix, enabled} = await this.database.getGuild(guildID, this.defaultPrefix);
            if (content.startsWith(prefix)) {
                content = content.substring(prefix.length);
                for (const plugin of this.plugins) {
                    if (enabled.includes(plugin.name)) {
                        if (plugin.tryHandleCommand(content, message, guildID, this)) return;
                    }
                }
            }
        } else {
            if (content.startsWith(this.defaultPrefix)) {
                for (const plugin of this.plugins) {
                    if (plugin.tryHandleCommand(content, message, guildID, this)) return;
                }
            }
        }
    }

    registerPlugin(plugin: Plugin<any>) {
        this.plugins.push(plugin);
    }
}

export class Plugin<T extends AbstractPluginData> {
    readonly name: PluginSlug;
    readonly description: string;
    readonly aliases: PluginAliases = {};
    readonly perms: PluginPerms = {};
    readonly data: T;
    readonly commands: Command[] = [];

    constructor(name: PluginSlug="", description: string="", defaultData: T) {
        this.name = name;
        this.description = description;
        this.data=defaultData;
    }

    addCommand(command: Command) {
        command.plugin = this;
        this.aliases[command.name] = command.aliases;
        this.commands.push(command);
    }

    private static checkRoles(member: GuildMember, commandPerms: string[]): boolean {
        if (commandPerms.includes("@everyone")) return true;
        for (const perm of commandPerms) {
            if (member.roles.cache.has(perm)) return true;
        }
        return false;
    }

    /**
     * @returns handled status
     */
    async tryHandleCommand(content: string, message: Message, guildID: string | undefined, handler: Handler): Promise<boolean> {
        const { aliases, perms } = guildID ? await handler.database.getGuildPluginAliasesAndPerms(guildID, this.name, this.aliases, this.perms) : this;
        for (const command of this.commands) {
            if (content.startsWith(command.name)) {
                if (!guildID && !command.allowDM) command.noDM(message.channel);
                if (!guildID || ((<GuildMember>message.member).permissions.bitfield & 40 || Plugin.checkRoles(<GuildMember>message.member, perms[command.name] ?? command.perms) || message.author.id === handler.owner)) {
                    await command.message(content.substring(command.name.length + 1), guildID ? <GuildMember>message.member : message.author, message.guild, message.channel, message, handler);
                } else {
                    command.noPerms(message.channel);
                }
                return true;
            }
            for (const alias of aliases[command.name] ?? command.aliases) {
                if (content.startsWith(alias)) {
                    if (!guildID && !command.allowDM) command.noDM(message.channel);
                    if (!guildID || ((<GuildMember>message.member).permissions.bitfield & 40 || Plugin.checkRoles(<GuildMember>message.member, perms[command.name] ?? command.perms) || message.author.id === handler.owner)) {
                        await command.message(content.substring(alias.length + 1), guildID ? <GuildMember>message.member : message.author, message.guild, message.channel, message, handler);
                    } else {
                        command.noPerms(message.channel);
                    }
                    return true;
                }
            }
        }
        return false;
    }
}

export class RichEmbed extends MessageEmbed {
    constructor(data?: MessageEmbed | MessageEmbedOptions) {
        super(data);
        this.setTimestamp();
        this.setFooter("Wagyourtail 2021. bot.wagyourtail.xyz");
    }
}

export abstract class Command {
    readonly name;
    readonly aliases;
    readonly usage;
    readonly description;
    readonly perms: string[];
    readonly allowDM;
    plugin!: Plugin<any>;

    constructor(name="", aliases: string[]=[], usage="", description="", everyoneDefault=false, allowDM=false) {
        this.name = name;
        this.aliases = aliases;
        this.usage = usage;
        this.description = description;
        this.perms = everyoneDefault ? ["@everyone"] : [];
        this.allowDM = allowDM;
    }

    async selfHelp(channel: TextChannel | DMChannel | NewsChannel, guild: Guild | null, handler: Handler) {
        const reply = new RichEmbed()
            .setTitle(`Help: ${this.name}`)
            .addField("Usage", this.usage)
            .addField("Description", this.description)
            .setDescription(this.plugin?.name);
        const thumbnail = handler.user?.avatarURL();
        if (thumbnail) reply.setThumbnail(thumbnail);
        if (guild?.id) {
            const { aliases, perms } = await handler.database.getGuildPluginAliasesAndPerms(guild.id, this.plugin.name, this.plugin.aliases, this.plugin.perms);
            if (aliases.length) reply.addField("Aliases", (aliases[this.name] ?? this.aliases).join(", "));
            const roles = [];
            for (const role of perms[this.name] ?? this.perms) {
                if (role === "@everyone") {
                    roles.push(role);
                    continue;
                }
                let roleResolve = guild.roles.resolve(role);
                if (roleResolve) roles.push(roleResolve.toString());
            }
            if (roles.length) reply.addField("Perms", roles.join(", "));
        } else {
            reply.addField("Default Aliases", this.aliases.join(", "));
            reply.addField("Default Perms", this.perms.join(", "));
        }
        channel.send(reply);
    }

    async noDM(channel: TextChannel | DMChannel | NewsChannel) {
        return this.sendError("Command Not Allowed In DM!", channel);
    }

    async noPerms(channel: TextChannel | DMChannel | NewsChannel) {
        return this.sendError("You Do Not Have Permission To Run This Command!", channel);
    }

    async sendError(error: string, channel: TextChannel | DMChannel | NewsChannel): Promise<Message> {
        return await channel.send(new RichEmbed()
            .setTitle(this.name)
            .setColor(0xFF0000)
            .setDescription(error)
        );
    }

    abstract message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): Promise<void>;

}

export interface CommandPart {
    readonly name: string;
    readonly match: RegExp | undefined;
    eval: CommandEval | undefined;
    next: CommandPart[] | undefined;
    readonly allowDM: boolean;
}

export type CommandEval = (args: {[name: string]: (string | undefined)[] | string}, remainingContent: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler) => Promise<void>;

export abstract class CommandTree extends Command {
    readonly head: CommandPart;
    readonly parents: CommandPart[] = [];
    current: CommandPart;

    constructor(name="", aliases: string[]=[], usage="", description="", everyoneDefault=false, allowDM=false) {
        super(name, aliases, usage, description, everyoneDefault, allowDM);
        this.head = {name: "head", match: undefined, eval: undefined, next: undefined, allowDM: allowDM};
        this.current = this.head;
        this.buildCommandTree();
        if (this.head.next === undefined) throw new Error(`no branches on "head" for command "${name}"`);
    }

    abstract buildCommandTree(): void;

    defaultEval(evalContent: CommandEval) {
        this.head.eval = evalContent;
    }

    then(name: string, allowDM = false, match?: RegExp, evalContent?: CommandEval): CommandTree {
        this.parents.push(this.current);
        const nextCurrent = {
            name: name,
            match: match,
            eval: evalContent,
            next: undefined,
            allowDM: allowDM
        }
        if (this.current.next === undefined) {
            this.current.next = [nextCurrent];
        } else {
            this.current.next.push(nextCurrent);
        }
        this.current = nextCurrent;
        return this;
    }

    or(name?: string, allowDM = false, match?: RegExp, evalContent?: CommandEval): CommandTree {
        if (!this.parents.length) throw Error("\"or\" on head...");
        this.current = <CommandPart>this.parents.pop();
        if (name) this.then(name, allowDM, match, evalContent);
        return this;
    }

    private evalTree(current: CommandPart, prevArgs: ([CommandPart, string[] | string])[], remainingContent: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): void {
        if (current.next !== undefined) {
            for (const nextPart of current.next) {
                if (nextPart.match === undefined) {
                    if (remainingContent.startsWith(nextPart.name + " ") || remainingContent === nextPart.name) {
                        if (!guild && !nextPart.allowDM) {
                            this.noDM(channel);
                            return;
                        }
                        prevArgs.push([nextPart, nextPart.name]);
                        this.evalTree(nextPart, prevArgs, remainingContent.substring(nextPart.name.length).trim(), member, guild, channel, message, handler);
                        return;
                    }
                } else {
                    const match = remainingContent.match(nextPart.match);
                    if (match) {
                        if (!guild && !nextPart.allowDM) {
                            this.noDM(channel);
                            return;
                        }
                        prevArgs.push([nextPart, <string[]>match])
                        this.evalTree(nextPart, prevArgs, remainingContent.substring(match[0].length).trim(), member, guild, channel, message, handler);
                        return;
                    }
                }
            }
        }
        if (current.eval === undefined) {
            this.sendError(`Incomplete command ${prevArgs.map(e => e[0].name).join(" ")}`, channel);
            return;
        }
        const args: {[name: string]: string[] | string} = {};
        for (const [cmdPart, partArgs] of prevArgs) {
            args[cmdPart.name] = partArgs;
        }
        current.eval(args, remainingContent, member, guild, channel, message, handler);
        return;
    }

    async message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler) {
        this.evalTree(this.head, [], content, member, guild, channel, message, handler);
    }
}