import { WebPlugin } from "../../../web/WagYourBotWeb";
import { StreamingRoleData } from "./StreamingRoleCommon";
import { CommandTree, Handler, RichEmbed, TreeTypes } from "../../Handler";
import { Activity, Guild, Presence } from "discord.js";


class StreamRole extends CommandTree<StreamingRoleData> {
    constructor() {
        super("streamrole", [], "set the role to give people who are streaming.");
    }

    buildCommandTree() {
        this.then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const role = await guild.roles.fetch(args.role);
            if (role) {
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, {roleid: role.id});
                channel.send(new RichEmbed().setTitle("StreamRole").setDescription(`Successfully set stream role to ${role}`));
            } else {
                channel.send(new RichEmbed().setTitle("StreamRole").setDescription(`role ${args.role} did not parse to a known role`));
            }
        })
    }
}

class StreamingRolePlugin extends WebPlugin<StreamingRoleData> {
    registerExtraListeners(handler: Handler) {
        handler.on("presenceUpdate", (oldp, newp) => this.onPresence(oldp, newp, handler));
    }

    async onPresence(oldP: Presence | undefined, newP: Presence | undefined, handler: Handler) {
        const guild: Guild = <Guild>oldP?.guild ?? newP?.guild;
        const {enabled} = await handler.database.getGuild(guild.id, handler.defaultPrefix);
        if (enabled.includes(this.name)) {
            const data = await handler.database.getGuildPluginData(guild.id, this.name, this.data);
            const role = await guild.roles.fetch(<string>data.roleid);
            if (role) {
                if (newP?.activities?.filter((e: Activity) => e.type === "STREAMING").length) {
                    newP.member?.roles.add(role, "Streaming");
                } else if (oldP?.activities?.filter((e: Activity) => e.type === "STREAMING").length) {
                    oldP.member?.roles.remove(role, "Done Streaming");
                }
            }
        }
    }


}

export const plugin = new StreamingRolePlugin("StreamingRole", "Give users who are live a role.", {})
plugin.addCommand(new StreamRole());