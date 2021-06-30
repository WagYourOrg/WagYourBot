import { Guild, Snowflake } from "discord.js";
import { stat } from "fs";
import { CommandTree, Handler, Plugin, RichEmbed, TreeTypes } from "../../Handler";
import { AbstractPluginData } from "../../Structures";

interface MemberRankData extends AbstractPluginData {
    dynamic: {
        [key: number]: Snowflake | undefined;
    },
    static: {
        [key: number]: Snowflake | undefined;
    }
}

function getPoints(timeSinceLast: number): number {
    if (timeSinceLast <= 30) {
        return 0;
    }
    if (timeSinceLast <= 60) {
        return Math.floor(timeSinceLast / 6);
    }
    if (timeSinceLast <= 24 * 60 * 60) {
        return 10;
    }
    return Math.floor((7 * 24 * 60 * 60) / timeSinceLast);
}

class MRRole extends CommandTree<MemberRankData> {
    constructor() {
        super("mrrole", [], "set roles members acquire from their rank.");
    }
    buildCommandTree(): void {
        this.then("list", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            const reply = new RichEmbed()
                .setTitle("MemberRankRole: list");
            const dynamic: string[] = [];
            for (const [key, val] of Object.entries(data.dynamic)) {
                dynamic.push(`${key}%: ${await guild.roles.fetch(val)}`);
            }
            reply.addField("Dynamic", dynamic.join("\n"));
            const statuc: string[] = [];
            for (const [key, val] of Object.entries(data.static)) {
                statuc.push(`${key}: ${await guild.roles.fetch(val)}`);
            }
            reply.addField("Static", statuc.join("\n"));
            channel.send(reply);
        })
        .or("add")
            .then("percent", {type: /(\d+)%/, argFilter: (arg) => <string>arg[1]})
                .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const role = await guild.roles.fetch(args.role);
                    const percent = parseInt(args.percent);
                    if (percent < 0 || percent > 100) {
                        channel.send(new RichEmbed().setTitle("MemberRankRole: Add").setDescription(`Error: percent must be in range 0 - 100, got ${percent}`));
                        return;
                    }
                    if (!role) {
                        channel.send(new RichEmbed().setTitle("MemberRankRole: Add").setDescription(`Error: did not find role for \`${args.role}\``));
                        return;
                    }
                    data.dynamic[percent] = role.id;
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                    channel.send(new RichEmbed().setTitle("MemberRankRole: Add").setDescription(`Success, members over ${percent}% should recieve ${role}`));
                    (<MemberRankPlugin>this.plugin).forceUpdate(guild, data);
                }).or()
            .or("rank", {type: TreeTypes.INTEGER})
                .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    const role = await guild.roles.fetch(args.role);
                    const rank = parseInt(args.rank);
                    if (rank < 1) {
                        channel.send(new RichEmbed().setTitle("MemberRankRole: Add").setDescription(`Error: rank must be > 0, got ${rank}`));
                        return;
                    }
                    if (!role) {
                        channel.send(new RichEmbed().setTitle("MemberRankRole: Add").setDescription(`Error: did not find role for \`${args.role}\``));
                        return;
                    }
                    data.static[rank] = role.id;
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                    channel.send(new RichEmbed().setTitle("MemberRankRole: Add").setDescription(`Success, members over rank ${rank} should recieve ${role}`));
                    (<MemberRankPlugin>this.plugin).forceUpdate(guild, data);
                }).or()
            .or()
        .or("del")
            .then("role")
                .then("role", {type: TreeTypes.ROLE}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                    for (const [key, value] of Object.entries(data.dynamic)) {
                        if (value === args.role) {
                            data.dynamic[<any>key] = undefined;
                        }
                    }
                    for (const [key, value] of Object.entries(data.static)) {
                        if (value === args.role) {
                            data.static[<any>key] = undefined;
                        }
                    }
                    await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                    channel.send(new RichEmbed().setTitle("MemberRankRole: Delete").setDescription(`Success, any rank/percent associated with <@${args.role}> has been removed.`));
                }).or()
            .or("percent", {type: /(d+)%/, argFilter: (arg) => <string>arg[1]}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const percent = parseInt(args.percent);
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                const role = (await guild.roles.fetch(<Snowflake>data.dynamic[percent])) ?? args;
                
            })
            .or("rank", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {

            })
                
    }
}



class MemberRankPlugin extends Plugin<MemberRankData> {
    registerExtraListeners(handler: Handler) {

    }

    forceUpdate(guild: Guild, data: MemberRankData): void {

    }
}



export const plugin = new MemberRankPlugin("MemberRank", "Guild member rankings and scoring and roles based on messages sent.", {dynamic: {}, static: {}});