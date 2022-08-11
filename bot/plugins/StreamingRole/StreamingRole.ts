import { WebPlugin } from "../../../web/WagYourBotWeb";
import { StreamingRoleData } from "./StreamingRoleCommon";
import { CommandTree, Handler, RichEmbed, TreeTypes } from "../../Handler";
import { Activity, ActivityType, Guild, Presence } from "discord.js";


class StreamRole extends CommandTree<StreamingRoleData> {
    constructor() {
        super("streamrole", [], "set the role to give people who are streaming.");
    }

    buildCommandTree() {
        this.then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const role = await guild.roles.fetch(args.role);
            if (role) {
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, {roleid: role.id});
                channel.send({embeds: [new RichEmbed().setTitle("StreamRole").setDescription(`Successfully set stream role to ${role}`)]});
            } else {
                channel.send({embeds: [new RichEmbed().setTitle("StreamRole").setDescription(`role ${args.role} did not parse to a known role`)]});
            }
        })
    }
}

class StreamingRolePlugin extends WebPlugin<StreamingRoleData> {
    registerExtraListeners(handler: Handler) {
        // @ts-ignore
        handler.on("presenceUpdate", (oldp, newp) => this.onPresence(oldp, newp, handler));
    }

    async onPresence(oldP: Presence | null, newP: Presence | undefined, handler: Handler) {
        try {
            const guild: Guild = <Guild>oldP?.guild ?? newP?.guild;
            const {enabled} = await handler.database.getGuild(guild.id, handler.defaultPrefix);
            if (enabled.includes(this.name)) {
                const data = await handler.database.getGuildPluginData(guild.id, this.name, this.data);
                const role = await guild.roles.fetch(<string>data.roleid);
                if (role) {
                    if (newP?.activities?.filter((e: Activity) => e.type === ActivityType.Streaming).length) {
                        newP.member?.roles.add(role, "Streaming");
                    } else if (oldP?.activities?.filter((e: Activity) => e.type === ActivityType.Streaming).length) {
                        oldP.member?.roles.remove(role, "Done Streaming");
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }


}

export const plugin = new StreamingRolePlugin("StreamingRole", "Give users who are live a role.", {})
plugin.addCommand(new StreamRole());