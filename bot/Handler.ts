import { ClientUser, MessageEmbedOptions, MessageReaction, NewsChannel } from "discord.js";
import { Client as BaseClient, DMChannel, Guild, GuildMember, Message, MessageEmbed, TextChannel, User } from "discord.js";
import { SQLDatabase } from "../Database";
import { PluginAliases, PluginPerms, Database, PluginSlug } from "../Structures";


export abstract class Handler extends BaseClient {
    readonly defaultPrefix = "!!";
    readonly database: Database;
    readonly plugins: Plugin<any>[] = [];
    readonly owner = "100748674849579008";
    readonly clientID;

    protected constructor(clientID: string) {
        super({ partials: [ "REACTION", "MESSAGE", "USER" ] });
        this.clientID = clientID;
        this.registerPlugins();
        this.database = new SQLDatabase(this.plugins.map(e => e.name), clientID);

        this.on("message", this.onMessage);
    }

    abstract registerPlugins(): void;

    async login() {
        return await super.login(await this.database.getClientToken(this.clientID));
    }

    async onMessage(message: Message) {
        if (message.author.bot) return;
        const guildID = message.guild?.id;
        let content = message.content;
        try {
            if (guildID) {
                const {prefix, enabled} = await this.database.getGuild(guildID, this.defaultPrefix);
                for (const plugin of this.plugins) {
                    if (enabled.includes(plugin.name)) plugin.onMessage(message, this);
                }
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
                        plugin.onMessage(message, this);
                    }
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

export class Plugin<T> {
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

    /**
     * pre-checked event listener for plugin enabled, all the others can be registered with {@link Plugin#registerExtraListeners(Handler)}
     * @param message
     * @param handler
     */
    async onMessage(message: Message, handler: Handler) {}

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
                if (!guildID && !command.allowDM) command.noDM(message);
                if (!guildID || ((<GuildMember>message.member).permissions.bitfield & 40 || Plugin.checkRoles(<GuildMember>message.member, perms[command.name] ?? command.perms) || message.author.id === handler.owner)) {
                    await command.message(content.substring(command.name.length + 1), guildID ? <GuildMember>message.member : message.author, message.guild, message.channel, message, handler);
                } else {
                    command.noPerms(message);
                }
                return true;
            }
            // console.log(command.name, aliases[command.name], aliases);
            for (const alias of aliases[command.name] ?? command.aliases) {
                if (content === alias || content.startsWith(alias + " ")) {
                    if (!guildID && !command.allowDM) command.noDM(message);
                    if (!guildID || ((<GuildMember>message.member).permissions.bitfield & 40 || Plugin.checkRoles(<GuildMember>message.member, perms[command.name] ?? command.perms) || message.author.id === handler.owner)) {
                        await command.message(content.substring(alias.length + 1), guildID ? <GuildMember>message.member : message.author, message.guild, message.channel, message, handler);
                    } else {
                        command.noPerms(message);
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

export abstract class Command<T> {
    readonly name;
    readonly aliases;
    readonly usage;
    readonly description;
    readonly perms: string[];
    readonly allowDM;
    plugin!: Plugin<T>;

    protected constructor(name="", aliases: string[]=[], usage="", description="", everyoneDefault=false, allowDM=false) {
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
            if (aliases[this.name]?.length) reply.addField("Aliases", (aliases[this.name] ?? this.aliases).join(", "));
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
            if (this.aliases.length) {
                reply.addField("Default Aliases", this.aliases.join(", "));
            }
            if (this.perms.length) {
                reply.addField("Default Perms", this.perms.join(", "));
            }
        }
        channel.send(reply);
    }

    async noDM(message: Message) {
        return this.sendError("Command Not Allowed In DM!", message);
    }

    async noPerms(message: Message) {
        return this.sendError("You Do Not Have Permission To Run This Command!", message);
    }

    async sendError(error: string, message: { channel: TextChannel | DMChannel | NewsChannel }): Promise<Message> {
        return await message.channel.send(new RichEmbed()
            .setTitle(this.name)
            .setColor(0xFF0000)
            .setDescription(error)
        );
    }

    abstract message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): Promise<void>;

    /**
     * do **not** await this... 
     */
    static async paginateData(channel: TextChannel | DMChannel | NewsChannel, handler: Handler, baseEmbed: RichEmbed, lines: {length: number, slice: (start: number, end: number) => string[] | Promise<string[]>}, linesPerPage = 20) {
        let currentPage = 0;
        let maxPages = Math.ceil(lines.length / linesPerPage);
        if (maxPages > 1) {
            let message = await channel.send(new RichEmbed(baseEmbed).setDescription((await lines.slice(0, linesPerPage)).join("\n")).addField("Page", `${currentPage + 1} / ${maxPages}`));
            await message.react("⬅️");
            await message.react("➡️");
            let reaction: MessageReaction | null = null;
            do {
                reaction = [...(await message.awaitReactions((reaction) => ["⬅️", "➡️"].includes(reaction.emoji.name), {idle: 60000, max:1})).values()][0];
                await reaction?.users.remove(Array.from(reaction?.users.cache.keys()).filter(e => e != (<ClientUser>handler.user).id)[0]);
                if (currentPage > 0 && reaction?.emoji?.name === "⬅️") --currentPage;
                else if (currentPage + 1 < maxPages && reaction?.emoji?.name === "➡️") ++currentPage;
                else continue;
                message.edit(new RichEmbed(baseEmbed).setDescription((await lines.slice(currentPage * linesPerPage, Math.min((currentPage + 1) * linesPerPage, lines.length))).join("\n")).addField("Page", `${currentPage + 1} / ${maxPages}`));
            } while (reaction);
            
        } else {
            channel.send(new RichEmbed(baseEmbed).setDescription((await lines.slice(0, lines.length)).join("\n")));
        }
    }
}

//compiled command structure, instances of this is the result of then/or in CommandTree
interface CommandPart {
    readonly name: string;
    type: TreeTypes,
    readonly match?: RegExp;
    lookahead: boolean
    eval?: CommandEval<any>;
    filter?: ArgFilter<any>,
    next?: CommandPart[];
    readonly allowDM: boolean;
}

interface UsagePart {
    readonly current: {name: string, isMatch: boolean}[];
    readonly next: (string|null)[];
}

//jank generic magic types
type CommandEval<T> = (args: T, remainingContent: string, member: GuildMember, guild: Guild, channel: TextChannel | NewsChannel, message: Message, handler: Handler) => Promise<void>;
type DMCommandEval<T> = (args: T, remainingContent: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler) => Promise<void>;
type ArgFilter<T> = (arg: (string | undefined)[], message: Message) => T;
type TreeOptions<U> = {allowDM?: boolean, type?:TreeTypes} |
    {allowDM?: boolean, type: RegExp, lookahead?: boolean, argFilter?: ArgFilter<U>};


//this might become more useful for compiling actual slash command structures later...
export enum TreeTypes {
    SUB_COMMAND, STRING, INTEGER, BOOLEAN, USER, CHANNEL, ROLE, OTHER
}

/**
 * @param T current params
 * @param V prev type
 * @param W prev params
 */
export interface Tree<T = {}, V extends Tree<W, any, any> | null = null, W = {}> {
    then<U, A>(name: string & keyof U, options: {allowDM: true} & {argFilter: ArgFilter<A>} & TreeOptions<A>, exec?: DMCommandEval<{[key in keyof U]: A} & T>): Tree<{[key in keyof U]: A} & T, Tree<T, V, W>, T>;
    then<U, A>(name: string & keyof U, options: {allowDM?: false} & {argFilter: ArgFilter<A>} & TreeOptions<A>, exec?: CommandEval<{[key in keyof U]: A} & T>): Tree<{[key in keyof U]: A} & T, Tree<T, V, W>, T>;

    then<U>(name: string & keyof U, options?: {allowDM: true} & TreeOptions<string>, exec?: DMCommandEval<{[key in keyof U]: string} & T>): Tree<{[key in keyof U]: string} & T, Tree<T, V, W>, T>;
    then<U>(name: string & keyof U, options?: {allowDM?: false} & TreeOptions<string>, exec?: CommandEval<{[key in keyof U]: string} & T>):Tree<{[key in keyof U]: string} & T, Tree<T, V, W>, T>;

    or<U, A>(name: string & keyof U, options: {allowDM: true} & {argFilter: ArgFilter<A>} & TreeOptions<A>, exec?: DMCommandEval<{[key in keyof U]: A} & W>): Tree<{[key in keyof U]: A} & W, V, W>;
    or<U, A>(name: string & keyof U, options: {allowDM?: false} & {argFilter: ArgFilter<A>} & TreeOptions<A>, exec?: CommandEval<{[key in keyof U]: A} & W>): Tree<{[key in keyof U]: A} & W, V, W>;

    or<U>(name: string & keyof U, options?: {allowDM: true} & TreeOptions<string>, exec?: DMCommandEval<{[key in keyof U]: string} & W>): Tree<{[key in keyof U]: string} & W, V, W>;
    or<U>(name: string & keyof U, options?: {allowDM?: false} & TreeOptions<string>, exec?: CommandEval<{[key in keyof U]: string} & W>): Tree<{[key in keyof U]: string} & W, V, W>;

    or(): V;

    defaultEval(evalContent: DMCommandEval<{}>): void;
}

export abstract class CommandTree<T> extends Command<T> implements Tree {
    readonly head: CommandPart;
    readonly parents: CommandPart[] = [];
    current: CommandPart;

    protected constructor(name="", aliases: string[]=[], description="", everyoneDefault=false, allowDM=false) {
        super(name, aliases, "", description, everyoneDefault, allowDM);
        
        this.head = {name: name, match: undefined, type: TreeTypes.OTHER, eval: undefined, lookahead: false, next: undefined, allowDM: this.allowDM};
        this.current = this.head;
        this.buildCommandTree();
        this.head.next?.unshift({name: "help", type: TreeTypes.SUB_COMMAND, lookahead: false, eval: async (args, remainingContent, member, guild, channel, message, handler) => this.selfHelp(channel, guild, handler), allowDM: true});

        if (this.head.next === undefined && this.head.eval === undefined) throw new Error(`no branches on "head" for command "${name}"`);
        //cast to remove readonly
        (<{usage: string}>this).usage = CommandTree.compileUsage(this.genUsage(this.head)).join("\n");
    }

    abstract buildCommandTree(): void;

    defaultEval(evalContent: DMCommandEval<{}>) {
        this.head.eval = evalContent;
    }

    private static compileUsage(part: UsagePart): string[] {
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
        return nexts.map(e => current + e);
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
            const next: (string|null)[] = parts.map(CommandTree.compileUsage).flat();
            if (current.eval !== undefined) next.push(null);
            return {current: [{name: current.name, isMatch: !!current.match}], next: next};
        } else {
            if (current.eval === undefined) throw new Error(`Cannot have endpoint (${current.name}) of command (${this.name}) with undefined eval.`);
            return {current: [{name: current.name, isMatch: !!current.match}], next: [null]};
        }
    }
    
    
    then<U, A>(name: string & keyof U, options: {allowDM: true} & {argFilter: ArgFilter<A>} & TreeOptions<A>, exec?: DMCommandEval<{[key in keyof U]: A}>): Tree<{[key in keyof U]: A}, CommandTree<T>>;
    then<U, A>(name: string & keyof U, options: {allowDM?: false} & {argFilter: ArgFilter<A>} & TreeOptions<A>, exec?: CommandEval<{[key in keyof U]: A}>): Tree<{[key in keyof U]: A}, CommandTree<T>>;

    then<U>(name: string & keyof U, options?: {allowDM: true} & TreeOptions<string>, exec?: DMCommandEval<{[key in keyof U]: string}>): Tree<{[key in keyof U]: string}, CommandTree<T>>;
    then<U>(name: string & keyof U, options?: {allowDM?: false} & TreeOptions<string>, exec?: CommandEval<{[key in keyof U]: string}>):Tree<{[key in keyof U]: string}, CommandTree<T>>;

    then<U, A>(name: string & keyof U, options: TreeOptions<A> = {}, exec?: CommandEval<{[key in keyof U]: A}>): Tree<{[key in keyof U]: A}, CommandTree<T>> {
        this.parents.push(this.current);
        if (typeof options.type === undefined) {
            options.type = TreeTypes.SUB_COMMAND;
        }
        let type: TreeTypes;
        let compiledType: RegExp | undefined;
        let argFilter: ArgFilter<any> | undefined;
        if (options.type instanceof RegExp) {
            compiledType = options.type;
            type = TreeTypes.OTHER;
            argFilter = (<{argFilter?: ArgFilter<any>}>options).argFilter;
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
                    compiledType = /[^\d]*?(\d+)/;
                    //force cast here, it doesn't matter in the internals because it's correct by now.
                    argFilter = <ArgFilter<any>>((arg) => arg[1]);
                    break;
                case TreeTypes.CHANNEL:
                    compiledType = /[^\d]*?(\d+)/;
                    //force cast here, it doesn't matter in the internals because it's correct by now.
                    argFilter = <ArgFilter<any>>((arg) => arg[1]);
                    break;
                case TreeTypes.ROLE:
                    compiledType = /[^\d]*?(\d+)[^\s]*|(@?everyone)\b/;
                    //force cast here, it doesn't matter in the internals because it's correct by now.
                    argFilter = <ArgFilter<any>>((arg) => arg[1] ? arg[1] : arg[2]);
                    break;
                case TreeTypes.SUB_COMMAND:
            }
            type = <TreeTypes>options.type;
        }
        
        //force cast here, it doesn't matter in the internals because it's correct by now.
        const nextCurrent: CommandPart = {
            name: name,
            match: compiledType ? new RegExp(compiledType?.source + "[^\\s]*", compiledType?.flags) : undefined,
            type: type,
            lookahead: !!(<{lookahead?: boolean}>options)?.lookahead,
            filter: argFilter,
            eval: exec,
            next: undefined,
            allowDM: !!(<{allowDM: boolean | undefined}>options).allowDM
        }
        if (this.current.next === undefined) {
            this.current.next = [nextCurrent];
        } else {
            this.current.next.push(nextCurrent);
        }
        this.current = nextCurrent;
        //force cast here, jank generic magic goes brr.
        return <any>this;
    }

    //let the interface side handle most of the typing for this one... shouldn't be called on CommandTree anyway as or/then are meant to be chained.
    or<U, A>(name?: string & keyof U, options: TreeOptions<A> = {}, exec?: CommandEval<{[key in keyof U]: A}>): never {
        if (!this.parents.length) throw Error("\"or\" on head...");
        this.current = <CommandPart>this.parents.pop();
        // force cast here, at this point the contents of options have been verified by the "or" typescript definitions.
        if (name) this.then<U, A>(name, <any>options, exec);
        //force cast here, jank generic magic goes brr.
        return <never>this;
    }

    private evalTree(current: CommandPart, prevArgs: ([CommandPart, string | undefined])[], remainingContent: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): void {
        if (current.next !== undefined) {
            for (const nextPart of current.next) {
                if (nextPart.match === undefined) {
                    if (remainingContent.startsWith(nextPart.name + " ") || remainingContent === nextPart.name) {
                        if (!guild && !nextPart.allowDM) {
                            this.noDM(message);
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
                            this.noDM(message);
                            return;
                        }
                        const argFilter: ArgFilter<any> = nextPart.filter ?? (arg => arg[0]);
                        prevArgs.push([nextPart, argFilter(<string[]>match, message)])
                        let lookAhead = nextPart.lookahead ? match[match.length - 1]?.length ?? 0 : 0;
                        this.evalTree(nextPart, prevArgs, remainingContent.substring(match[0].length - lookAhead).trim(), member, guild, channel, message, handler);
                        return;
                    }
                }
            }
        }
        if (current.eval === undefined) {
            this.sendError(`Incomplete command \`${this.name} ${prevArgs.map(e => e[0].name).join(" ")}\`, expected next part \`${current.next?.map(e => e.name).join("|")}\``, message);
            return;
        }
        const args: {[name: string]: string | undefined} = {};
        for (const [cmdPart, partArgs] of prevArgs) {
            args[cmdPart.name] = partArgs;
        }
        //force cast here, it doesn't matter after the command tree is built because it's correct by now.
        current.eval(args, remainingContent, <any>member, <any>guild,<any>channel, message, handler);
        return;
    }

    async message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler) {
        this.evalTree(this.head, [], content, member, guild, channel, message, handler);
    }
}