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
                if (!guildID && !command.allowDM) command.noDM(message.channel, handler);
                if (!guildID || ((<GuildMember>message.member).permissions.bitfield & 40 || Plugin.checkRoles(<GuildMember>message.member, perms[command.name]) || message.author.id === handler.owner)) {
                    await command.message(content.substring(command.name.length + 1), guildID ? <GuildMember>message.member : message.author, message.guild, message.channel, message, handler);
                } else {
                    command.noPerms(message.channel, handler);
                }
                return true;
            }
            for (const alias of aliases[command.name]) {
                if (content.startsWith(alias)) {
                    if (!guildID && !command.allowDM) command.noDM(message.channel, handler);
                    if (!guildID || ((<GuildMember>message.member).permissions.bitfield & 40 || Plugin.checkRoles(<GuildMember>message.member, perms[command.name]) || message.author.id === handler.owner)) {
                        await command.message(content.substring(alias.length + 1), guildID ? <GuildMember>message.member : message.author, message.guild, message.channel, message, handler);
                    } else {
                        command.noPerms(message.channel, handler);
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
            if (aliases.length) reply.addField("Aliases", aliases[this.name].join(", "));
            const roles = [];
            for (const role of perms[this.name]) {
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

    async noDM(channel: TextChannel | DMChannel | NewsChannel, handler: Handler) {
        const reply = new RichEmbed()
            .setTitle(this.name)
            .setColor(0xFF0000)
            .setDescription("Command Not Allowed In DM!");
    }

    async noPerms(channel: TextChannel | DMChannel | NewsChannel, handler: Handler) {
        const reply = new RichEmbed()
            .setTitle(this.name)
            .setColor(0xFF0000)
            .setDescription("You Do Not Have Permission To Run This Command!");
    }

    abstract message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): Promise<void>;

}