import { GuildMember, User, TextChannel, DMChannel, NewsChannel, Message, Guild } from "discord.js";
import { Command, Handler, Plugin, RichEmbed } from "../../Handler";
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

export const plugin = new Plugin<HelpData>("Default", "Default enabled stuff, don't disable", {});
plugin.addCommand(new Help());