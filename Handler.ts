import { Channel, ClientUser, MessageEmbedOptions, MessageReaction, NewsChannel } from "discord.js";
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
        try {
            if (guildID) {
                const {prefix, enabled} = await this.database.getGuild(guildID, this.defaultPrefix);
                if (content.startsWith(prefix)) {
                    content = content.substring(prefix.length);
                    for (const plugin of this.plugins) {
                        if (enabled.includes(plugin.name)) {
                            if (await plugin.tryHandleCommand(content, message, guildID, this)) return;
                        }
                    }
                }
            } else {
                if (content.startsWith(this.defaultPrefix)) {
                    for (const plugin of this.plugins) {
                        if (await plugin.tryHandleCommand(content, message, guildID, this)) return;
                    }
                }
            }
        } catch(error) {
            message.channel.send(new RichEmbed().setTitle("AN ERROR HAS OCCURED").setDescription(`Debug data dumped: \`\`\`${error}\`\`\``).setColor(0xFF0000));
        }
    }

    registerPlugin(plugin: Plugin<any>) {
        this.plugins.push(plugin);
        plugin.registerExtraListeners(this);
    }
}

export class Plugin<T extends AbstractPluginData> {
    readonly name: PluginSlug;
    readonly description: string;
    readonly aliases: PluginAliases = {};
    readonly perms: PluginPerms = {};
    readonly data: T;
    readonly commands: Command<T>[] = [];

    constructor(name: PluginSlug="", description: string="", defaultData: T) {
        this.name = name;
        this.description = description;
        this.data=defaultData;
    }

    addCommand(command: Command<T>) {
        command.plugin = this;
        this.aliases[command.name] = command.aliases;
        this.commands.push(command);
    }

    registerExtraListeners(handler: Handler) {}

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
            if (content === command.name || content.startsWith(command.name + " ")) {
                if (!guildID && !command.allowDM) command.noDM(message.channel);
                if (!guildID || ((<GuildMember>message.member).permissions.bitfield & 40 || Plugin.checkRoles(<GuildMember>message.member, perms[command.name] ?? command.perms) || message.author.id === handler.owner)) {
                    await command.message(content.substring(command.name.length + 1), guildID ? <GuildMember>message.member : message.author, message.guild, message.channel, message, handler);
                } else {
                    command.noPerms(message.channel);
                }
                return true;
            }
            for (const alias of aliases[command.name] ?? command.aliases) {
                if (content === alias || content.startsWith(alias + " ")) {
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

export abstract class Command<T extends AbstractPluginData> {
    readonly name;
    readonly aliases;
    readonly usage;
    readonly description;
    readonly perms: string[];
    readonly allowDM;
    plugin!: Plugin<T>;

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

    /**
     * do **not** await this... 
     */
    static async paginateData(channel: TextChannel | DMChannel | NewsChannel, handler: Handler, baseEmbed: RichEmbed, lines: string[], maxLines = 20) {
        let i = 0;
        let j = 0;
        const pages: string[][] = [[]];
        for (const line of lines) {
            if (j + line.length > 1999 || i >= maxLines) {
                i = 1;
                j = line.length + 1;
                pages.push([line]);
            } else {
                ++i;
                j += line.length + 1;
                pages[pages.length - 1].push(line);
            }
        }
        let currentPage = 0;
        let maxPages = pages.length;
        if (maxPages > 1) {
            let message = await channel.send(new RichEmbed(baseEmbed).setDescription(pages[currentPage].join("\n")).addField("Page", `${currentPage + 1} / ${maxPages}`));
            await message.react("⬅️");
            await message.react("➡️");
            let reaction: MessageReaction | null = null;
            do {
                reaction = [...(await message.awaitReactions((reaction) => ["⬅️", "➡️"].includes(reaction.emoji.name), {idle: 60000, max:1})).values()][0];
                await reaction?.users.remove(Array.from(reaction?.users.cache.keys()).filter(e => e != (<ClientUser>handler.user).id)[0]);
                if (currentPage > 0 && reaction?.emoji?.name === "⬅️") --currentPage;
                else if (currentPage + 1 < maxPages && reaction?.emoji?.name === "➡️") ++currentPage;
                else continue;
                message.edit(new RichEmbed(baseEmbed).setDescription(pages[currentPage].join("\n")).addField("Page", `${currentPage + 1} / ${maxPages}`));
            } while (reaction);
            
        } else {
            channel.send(new RichEmbed(baseEmbed).setDescription(pages[0].join("\n")));
        }
    }
}

interface CommandPart {
    readonly name: string;
    type: TreeTypes,
    readonly match?: RegExp;
    eval?: CommandEval<any>;
    filter?: ArgFilter,
    next?: CommandPart[];
    readonly allowDM: boolean;
}

interface UsagePart {
    readonly current: {name: string, isMatch: boolean}[];
    readonly next: (string|null)[];
}

export type CommandEval<T> = (args: T, remainingContent: string, member: GuildMember | User, guild: Guild, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler) => Promise<void>;
export type DMCommandEval<T> = (args: T, remainingContent: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler) => Promise<void>;
export type ArgFilter = (arg: (string | undefined)[], message: Message) => string | undefined;


export enum TreeTypes {
    SUB_COMMAND, STRING, INTEGER, BOOLEAN, USER, CHANNEL, ROLE, OTHER
}

export type TreeOptions<T> = {allowDM?: boolean, type?:TreeTypes, argFilter?: ArgFilter, eval?: T} | 
    {allowDM?: boolean, type: RegExp, argFilter: ArgFilter, eval?: T};

export type NextTree<T, W extends CommandTree<X, any, Y> | null, X extends AbstractPluginData, Y> = CommandTree<X, W, Y & T, Y>

export abstract class CommandTree<T extends AbstractPluginData, W extends CommandTree<T, any, Z> | null = null, V = {}, Z = {}> extends Command<T> {
    readonly head: CommandPart;
    readonly parents: CommandPart[] = [];
    current: CommandPart;

    constructor(name="", aliases: string[]=[], description="", everyoneDefault=false, allowDM=false) {
        super(name, aliases, "", description, everyoneDefault, allowDM);
        
        this.head = {name: name, match: undefined, type: TreeTypes.OTHER, eval: undefined, next: undefined, allowDM: this.allowDM};
        this.current = this.head;
        this.buildCommandTree();
        this.head.next?.push({name: "help", type: TreeTypes.SUB_COMMAND, eval: async (args, remainingContent, member, guild, channel, message, handler) => this.selfHelp(channel, guild, handler), allowDM: true});

        if (this.head.next === undefined && this.head.eval === undefined) throw new Error(`no branches on "head" for command "${name}"`);
        //cast to remove readonly
        (<{usage: string}>this).usage = this.compileUsage(this.genUsage(this.head));
    }

    abstract buildCommandTree(): void;

    defaultEval(evalContent: DMCommandEval<V>) {
        this.head.eval = evalContent;
    }

    private compileUsage(part: UsagePart): string {
        const matches = [];
        const notMatches = [];
        for (const arg of part.current) {
            if (arg.isMatch)
                matches.push(arg.name);
            else
                notMatches.push(arg.name);
        }
        const enclose = matches.length || (notMatches.length > 1);
        let current = enclose ? "`" : "";
        if (matches.length) current += `<${matches.join("|")}>`;
        if (matches.length && notMatches.length) {
            current += "|";
        }
        if (notMatches.length) current += notMatches.join("|");
        current += enclose ? "`" : "";
        part.next.sort();
        const nexts: string[] = [];
        for (const next of part.next) {
            if (next === null) {
                nexts.push("");
            } else {
                nexts.push(" " + next);
            }
        }
        return current + nexts.join("\n" + current);
    }

    private genUsage(current: CommandPart): UsagePart {
        if (current.next) {
            const parts: UsagePart[] = [];
            for (const part of current.next) {
                parts.push(this.genUsage(part));
            }
            for (let i = 0; i < parts.length; ++i) {
                for (let j = 0; j < i; ++j) {
                    if (JSON.stringify(parts[i].next) === JSON.stringify(parts[j].next)) {
                        parts[j].current.push(...parts[i].current);
                        parts.splice(i, 1);
                        --i;
                        break;
                    }
                }
            }
            const next: (string|null)[] = parts.map(this.compileUsage);
            if (current.eval !== undefined) next.push(null);
            return {current: [{name: current.name, isMatch: !!current.match}], next: next}
        } else {
            if (current.eval === undefined) throw new Error("Cannot have endpoint of command with undefined eval.");
            return {current: [{name: current.name, isMatch: !!current.match}], next: [null]};
        }
    }

    then<U, A extends boolean>(name: string & keyof U, options?: {allowDM: true} & TreeOptions<DMCommandEval<V & U>>): NextTree<U, CommandTree<T, W, V>, T, V>;
    then<U, A extends boolean>(name: string & keyof U, options?: {allowDM?: false} & TreeOptions<CommandEval<V & U>>): NextTree<U, CommandTree<T, W, V>, T, V>;

    then<U>(name: string & keyof U, options: TreeOptions<CommandEval<V & U>> = {}): NextTree<U, CommandTree<T, W, V>, T, V> {
        this.parents.push(this.current);
        if (typeof options.type === undefined) {
            options.type = TreeTypes.SUB_COMMAND;
        }
        let type: TreeTypes;
        let compiledType: RegExp | undefined;
        if (options.type instanceof RegExp) {
            compiledType = options.type;
            type = TreeTypes.OTHER;
        } else {
            switch(<TreeTypes>options.type) {
                case TreeTypes.STRING:
                    compiledType = /\w+\b/;
                    break;
                case TreeTypes.INTEGER:
                    compiledType = /\d+\b/;
                    break;
                case TreeTypes.BOOLEAN:
                    compiledType = /true\b|false\b/i;
                    break;
                case TreeTypes.USER:
                    compiledType = /[^\d]*?(\d+)[^\s]*/;
                    options.argFilter = (arg) => arg[1];
                    break;
                case TreeTypes.CHANNEL:
                    compiledType = /[^\d]*?(\d+)[^\s]*/;
                    options.argFilter = (arg) => arg[1];
                    break;
                case TreeTypes.ROLE:
                    compiledType = /[^\d]*?(\d+)[^\s]*|(@everyone)\b/;
                    options.argFilter = (arg) => arg[1] ? arg[1] : arg[2];
                    break;
                case TreeTypes.SUB_COMMAND:
            }
            type = <TreeTypes>options.type;
        }
        
        const nextCurrent = {
            name: name,
            match: compiledType,
            type: type,
            argFilter: options.argFilter,
            eval: options.eval,
            next: undefined,
            allowDM: !!(<{allowDM: boolean | undefined}>options).allowDM
        }
        if (this.current.next === undefined) {
            this.current.next = [nextCurrent];
        } else {
            this.current.next.push(nextCurrent);
        }
        this.current = nextCurrent;
        return <any>this;
    }

    or<U, A extends boolean>(name: string & keyof U, options?: {allowDM: true} & TreeOptions<DMCommandEval<V & U>>): NextTree<U, W, T, Z>;
    or<U, A extends boolean>(name: string & keyof U, options?: {allowDM?: false} & TreeOptions<CommandEval<V & U>>): NextTree<U, W, T, Z>;
    or(): W;
    or(): W;

    or<U>(name?: string & keyof U, options: TreeOptions<CommandEval<V & U>> = {}): NextTree<U, W, T, Z> | W {
        if (!this.parents.length) throw Error("\"or\" on head...");
        this.current = <CommandPart>this.parents.pop();
        if (name) this.then(<string>name, <any>options);
        return <any>this;
    }

    private evalTree(current: CommandPart, prevArgs: ([CommandPart, string | undefined])[], remainingContent: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): void {
        if (current.next !== undefined) {
            for (const nextPart of current.next) {
                if (nextPart.match === undefined) {
                    if (remainingContent.startsWith(nextPart.name + " ") || remainingContent === nextPart.name) {
                        if (!guild && !nextPart.allowDM) {
                            this.noDM(channel);
                            return;
                        }
                        if (nextPart.filter) {
                            prevArgs.push([nextPart,  nextPart.filter([nextPart.name], message)]);
                        } else {
                            prevArgs.push([nextPart,  nextPart.name]);
                        }
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
                        const argFilter: ArgFilter = nextPart.filter ?? (arg => arg[0]);
                        prevArgs.push([nextPart, argFilter(<string[]>match, message)])
                        this.evalTree(nextPart, prevArgs, remainingContent.substring(match[0].length).trim(), member, guild, channel, message, handler);
                        return;
                    }
                }
            }
        }
        if (current.eval === undefined) {
            this.sendError(`Incomplete command \`${this.name} ${prevArgs.map(e => e[0].name).join(" ")}\`, expected next part \`${current.next?.map(e => e.name).join("|")}\``, channel);
            return;
        }
        const args: {[name: string]: string | undefined} = {};
        for (const [cmdPart, partArgs] of prevArgs) {
            args[cmdPart.name] = partArgs;
        }
        current.eval(args, remainingContent, member, <Guild>guild, channel, message, handler);
        return;
    }

    async message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler) {
        this.evalTree(this.head, [], content, member, guild, channel, message, handler);
    }
}