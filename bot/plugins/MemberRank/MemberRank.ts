import { Guild, GuildMember, Message, Role, Snowflake } from "discord.js";
import { Command, CommandTree, Handler, Plugin, RichEmbed, TreeTypes } from "../../Handler";
import {MemberRankData} from "./MemberRankcommon";
import {WebPlugin} from "../../../web/WagYourBotWeb";

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
                    (<MemberRankPlugin>this.plugin).forceUpdate(guild, data, handler);
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
                    (<MemberRankPlugin>this.plugin).forceUpdate(guild, data, handler);
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
                const role = (await guild.roles.fetch(<Snowflake>data.dynamic[percent])) ?? data.dynamic[percent];
                data.dynamic[percent] = undefined;
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                channel.send(new RichEmbed().setTitle("MemberRankRole: Delete").setDescription(`Success, ${percent}% -> ${role} has been removed.`));
            })
            .or("rank", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const rank = parseInt(args.rank);
                const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
                const role = (await guild.roles.fetch(<Snowflake>data.static[rank])) ?? data.static[rank];
                data.static[rank] = undefined;
                await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
                channel.send(new RichEmbed().setTitle("MemberRankRole: Delete").setDescription(`Success, ${rank} -> ${role} has been removed.`));
            }).or()
        .or("forceUpdate", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const msg = await channel.send(new RichEmbed().setTitle("MemberRankRole: force update").setDescription(`started force update of rank role assignments...`));
            await (<MemberRankPlugin>this.plugin).forceUpdate(guild, await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data), handler);
            msg.edit(new RichEmbed().setTitle("MemberRankRole: force update").setDescription(`finished force update of rank role assignments.`))
        })

                
    }
}

class MRXP extends CommandTree<MemberRankData> {
    constructor() {
        super("mrxp", [], "show user xp level.", true);
    }

    buildCommandTree(): void {
        this.then("user", {type: TreeTypes.USER}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const reply = new RichEmbed()
                .setTitle("MemberRankXP");
            const user = await guild.members.fetch(args.user).catch(() => null);
            if (!user) {
                channel.send(reply.setDescription(`Error: could not find user \`${args.user}\``));
                return;
            }
            const xp = await handler.database.getGuildMemberEXP(guild.id, this.plugin.name, user.id);
            reply.setDescription(user);
            if (!xp.rank) {
                reply.addField("Rank: #inf", "0 xp");
            } else {
                reply.addField(`Rank: #${xp.rank}`, `${xp.score} xp`);
            }
            channel.send(reply);
        }).defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            const reply = new RichEmbed()
                .setTitle("MemberRankXP");
            const xp = await handler.database.getGuildMemberEXP(<string>guild?.id, this.plugin.name, member.id);
            reply.setDescription(member);
            if (!xp.rank) {
                reply.addField("Rank: #inf", "0 xp");
            } else {
                reply.addField(`Rank: #${xp.rank}`, `${xp.score} xp`);
            }
            channel.send(reply);
        })
    }
}

class MRAdjust extends CommandTree<MemberRankData> {
    constructor() {
        super("mradjust", [], "Adjust xp of members.");
    }
    buildCommandTree(): void {
        this.then("add")
            .then("user", {type: TreeTypes.USER})
                .then("xp", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const user = await guild.members.fetch(args.user).catch(() => null);
                    if (!user) {
                        channel.send(new RichEmbed().setTitle("MemberRankAdjust: add").setDescription(`Error: could not find user \`${args.user}\``))
                        return;
                    }
                    handler.database.guildMemberAddEXP(guild.id, this.plugin.name, user.id, parseInt(args.xp));
                    channel.send(new RichEmbed().setTitle("MemberRankAdjust: Reset").setDescription(`Successfully added \`${args.xp}\` xp to ${user}`));
                    (<MemberRankPlugin>this.plugin).forceUpdate(guild, await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data), handler);
                }).or()
            .or()
        .or("sub")
            .then("user", {type: TreeTypes.USER})
                .then("xp", {type: TreeTypes.INTEGER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                    const user = await guild.members.fetch(args.user).catch(() => null);
                    if (!user) {
                        channel.send(new RichEmbed().setTitle("MemberRankAdjust: sub").setDescription(`Error: could not find user \`${args.user}\``))
                        return;
                    }
                    await handler.database.guildMemberAddEXP(guild.id, this.plugin.name, user.id, -parseInt(args.xp));
                    channel.send(new RichEmbed().setTitle("MemberRankAdjust: Reset").setDescription(`Successfully subtracted \`${args.xp}\` xp from ${user}`));
                    (<MemberRankPlugin>this.plugin).forceUpdate(guild, await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data), handler);
                }).or()
            .or()
        .or("reset")
            .then("user", {type: TreeTypes.USER}, async (args, remainingContent, member, guild, channel, message, handler) => {
                const user = await guild.members.fetch(args.user).catch(() => null);
                if (!user) {
                    channel.send(new RichEmbed().setTitle("MemberRankAdjust: reset").setDescription(`Error: could not find user \`${args.user}\``))
                    return;
                }
                const xp = await handler.database.getGuildMemberEXP(guild.id, this.plugin.name, user.id);
                await handler.database.guildMemberAddEXP(guild.id, this.plugin.name, user.id, -xp.score);
                channel.send(new RichEmbed().setTitle("MemberRankAdjust: Reset").setDescription(`Successfully reset ${user} to 0 xp.`));
                (<MemberRankPlugin>this.plugin).forceUpdate(guild, await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data), handler);
            })
            
    }

}

class MRTop extends CommandTree<MemberRankData> {
    constructor() {
        super("mrtop", [], "top users and xp.", true);
    }

    buildCommandTree(): void {
        this.defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            Command.paginateData(channel, handler, new RichEmbed().setTitle("MemberRankTop"), {
                length: await handler.database.getUserCount(<string>guild?.id, this.plugin.name),
                slice: async (start, end) => {
                    return (await handler.database.getRanks(<string>guild?.id, this.plugin.name, start + 1, end)).map((e, i) => `**${start + i + 1}.** <@${e.member}> : ${e.score}`);
                }
            });
        });
    }

}

class MemberRankPlugin extends WebPlugin<MemberRankData> {
    registerExtraListeners(handler: Handler) {

    }

    async forceUpdate(guild: Guild, data: MemberRankData, handler: Handler): Promise<void> {
        const chunk_size = 1000;
        const size = await handler.database.getUserCount(guild.id, this.name);
        for (let i = 0; i < size; i += chunk_size) {
            const ranks = await handler.database.getRanks(guild.id, this.name, i + 1, Math.min(i + chunk_size + 1, size));
            ranks.forEach(async (e, j) => {
                const member = await guild.members.fetch(e.member);
                j += i;
                for (const [rank, role] of Object.entries(data.dynamic)) {
                    if (j < (size * parseInt(rank) / 100) && await guild.roles.fetch(<string>role) && !member.roles.cache.has(<string>role)) member.roles.add(<string>role);
                    else if (j >= (size * parseInt(rank) / 100) && await guild.roles.fetch(<string>role) && member.roles.cache.has(<string>role)) member.roles.remove(<string>role);
                }
                for (const [rank, role] of Object.entries(data.static)) {
                    if (j < parseInt(rank) && await guild.roles.fetch(<string>role) && !member.roles.cache.has(<string>role)) member.roles.add(<string>role);
                    else if (j >= parseInt(rank) && await guild.roles.fetch(<string>role) && member.roles.cache.has(<string>role)) member.roles.remove(<string>role);
                }
            })
        }
    }

    async updateMember(member: GuildMember, guild: Guild, client: Handler) {
        const ranks = await client.database.getGuildPluginData(guild.id, "MemberRank", this.data);
        const userRank = await client.database.getGuildMemberEXP(guild.id, "MemberRank", member.id);
        for (const [rank, role] of Object.entries(ranks.static)) {
            if (userRank.rank < parseInt(rank) && await guild.roles.fetch(<string>role) && !member.roles.cache.has(<string>role)) member.roles.add(<string>role);
            if (userRank.rank >= parseInt(rank) && await guild.roles.fetch(<string>role) && member.roles.cache.has(<string>role)) member.roles.remove(<string>role);
        }
        const userCount = await client.database.getUserCount(guild.id, "MemberRank");
        for (const [rank, role] of Object.entries(ranks.dynamic)) {
            if (userRank.rank < (userCount * parseInt(rank) / 100) && await guild.roles.fetch(<string>role) && !member.roles.cache.has(<string>role)) member.roles.add(<string>role);
            if (userRank.rank >= (userCount * parseInt(rank) / 100) && await guild.roles.fetch(<string>role) && member.roles.cache.has(<string>role)) member.roles.remove(<string>role);
        }
        return <number>userRank.rank;
    }


    async onMessage(msg: Message, client: Handler) {
        try {
            if (msg.guild) {
                const time = (msg.createdTimestamp - await client.database.getGuildMemberLastMessageTime(msg.guild.id, "MemberRank", msg.author.id)) / 1000;
                if (time > 30) {
                    await client.database.guildMemberAddEXP(msg.guild.id, "MemberRank", msg.author.id, getPoints(time));
                    client.database.setGuildMemberLastMessageTime(msg.guild.id, "MemberRank", msg.author.id, msg.createdTimestamp);
                    const rank = await this.updateMember(<GuildMember>msg.member, msg.guild, client);

                    const memberID = (await client.database.getRanks(<string>msg.guild?.id, "MemberRank", rank, 1))[0];
                    const member = await msg.guild?.members.fetch(memberID.member).catch(() => null);
                    if (member) this.updateMember(member, msg.guild, client);
                    else if (memberID) client.database.deleteUser(<string>msg.guild?.id, "MemberRank", memberID.member);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}



export const plugin = new MemberRankPlugin("MemberRank", "Guild member rankings and scoring and roles based on messages sent.", {dynamic: {}, static: {}});
plugin.addCommand(new MRRole());
plugin.addCommand(new MRXP());
plugin.addCommand(new MRAdjust());
plugin.addCommand(new MRTop());