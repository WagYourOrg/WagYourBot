import { GuildMember, User, Guild, TextChannel, DMChannel, NewsChannel, Message } from "discord.js";
import { Command, Handler, Plugin, RichEmbed } from "../../Handler";
import {AIData} from "./AdvancedInfocommon";
import {WebPlugin} from "../../../web/WagYourBotWeb";

class AIListRoles extends Command<AIData> {
    constructor() {
        super("listroles", ["ailistroles"], "listroles", "list all server roles by id");
    }
    async message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): Promise<void> {
        const roles = await (<Guild>guild).roles.fetch();
        const formattedRoles = [];
        let i = 0;
        for (const [key, role] of roles.cache.sort((a,b) => b.position - a.position)) {
            formattedRoles.push(`**${++i}.** ${role}: ${role.id}`);
        }
        Command.paginateData(channel, handler, new RichEmbed().setTitle("Roles"), formattedRoles);
    }
}

export const plugin = new WebPlugin<AIData>("AdvancedInfo", "Nerd Stuff for Nerds", {});
plugin.addCommand(new AIListRoles());