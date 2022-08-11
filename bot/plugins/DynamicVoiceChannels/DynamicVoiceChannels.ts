import { CategoryChannel, ChannelType, GuildChannel, Snowflake } from "discord.js";
import { CommandTree, Handler, Plugin, RichEmbed, TreeTypes } from "../../Handler";
import {DVCData} from "./DynamicVoiceChannelscommon";
import {WebPlugin} from "../../../web/WagYourBotWeb";

class DVCSetCategory extends CommandTree<DVCData> {
    constructor() {
        super("dvccategory", ["lfpcategory"], "set category for dynamic voice channels to operate within.");
    }

    buildCommandTree(): void {
        this.then("channel", {type: TreeTypes.CHANNEL}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const chnl = guild.channels.resolve(args.channel);
            let category: CategoryChannel | null = null;
            if (chnl) {
                if (chnl.type === ChannelType.GuildCategory) {
                    category = <CategoryChannel>chnl;
                } else {
                    if (chnl.parent) {
                        if (chnl.parent?.type !== ChannelType.GuildCategory) {
                            if (chnl.parent.parent) {
                                category = chnl.parent.parent;
                            }
                        } else {
                            category = chnl.parent;
                        }
                    } else {
                        channel.send({embeds: [new RichEmbed().setTitle("DVC Categories").setDescription(`No parent category found for channel \`${chnl}\``)]});
                        return;
                    }
                }
            } else {
                channel.send({embeds: [new RichEmbed().setTitle("DVC Categories").setDescription(`channel \`${args.channel}\` failed to parse.`)]});
                return;
            }
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            data.id = category?.id;
            await handler.database.setGuildPluginData(guild.id, this.plugin.name, data);
            channel.send({embeds: [new RichEmbed().setTitle("DVC Categories").setDescription(`Successfully set Dynamic Voice Channel category to ${category}`)]});
        })
    }
}

class DVCSetName extends CommandTree<DVCData> {
    constructor() {
        super("dvcsetname", ["lfpsetgame"], "set name of your dynamic voice channel.", true);
    }

    buildCommandTree(): void {
        this.then("name", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data);
            if (data.id && data.id === member.voice.channel?.parent?.id) {
                member.voice.channel.setName(args.name);
            }
        });
    }
}

class DVCPlugin extends WebPlugin<DVCData> {
    registerExtraListeners(handler: Handler) {

        handler.on("voiceStateUpdate", async (oldVoice, newVoice) => {
            try {
                if ((await handler.database.getGuild(oldVoice.guild.id, handler.defaultPrefix)).enabled.includes(this.name)) {
                    const oldChannel = oldVoice.channel;
                    const newChannel = newVoice.channel;
                    const data = await handler.database.getGuildPluginData(oldVoice.guild.id, this.name, this.data);
                    if (data.id) {
                        if (oldChannel && oldChannel.parent?.id === data.id) {
                            const empty = [...oldChannel.parent.children.cache.filter(e => (e.type === ChannelType.GuildVoice && (e.members.size === 0))).values()];
                            if (empty.length === 0) {
                                oldChannel.parent.children.create({name: oldChannel.parent.name, type: ChannelType.GuildVoice});
                            } else {
                                empty.pop()?.setName(oldChannel.parent.name);
                                for (const chnl of empty) {
                                    await chnl.delete();
                                }
                            }
                        }
                        if (newChannel && newChannel.parent?.id === data.id) {
                            if (newChannel.members.size === 1 && newChannel.id !== oldChannel?.id) {
                                newChannel.setName(newVoice.member?.presence?.activities[0]?.name ?? newChannel.name);
                            }
                            const empty = [...newChannel.parent.children.cache.filter(e => e.type === ChannelType.GuildVoice && e.members.size === 0).values()];
                            if (empty.length === 0) {
                                newChannel.parent.children.create({name: newChannel.parent.name, type: ChannelType.GuildVoice});
                            } else {
                                empty.pop()?.setName(newChannel.parent.name);
                                for (const chnl of empty) {
                                    await chnl.delete();
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        });

    }
}

export const plugin = new DVCPlugin("DynamicVoiceChannels", "Dynamically manage the voice channels in a category to always have 1 more than the number in use.", {});
plugin.addCommand(new DVCSetCategory());
plugin.addCommand(new DVCSetName());