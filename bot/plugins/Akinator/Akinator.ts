import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    DMChannel,
    Guild,
    GuildMember,
    Message,
    NewsChannel,
    TextChannel,
    User
} from "discord.js";
import { Command, Handler, RichEmbed } from "../../Handler";
// @ts-ignore
import { Aki } from "aki-api.ts";
import { AkinatorData } from "./Akinatorcommon";
import { WebPlugin } from "../../../web/WagYourBotWeb";

class Akinator extends Command<AkinatorData> {
    constructor() {
        super("akinator", [], "akinator", "starts a game of akinator", true, true);
    }

    async message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): Promise<void> {
        const gd = new Aki('en');
        await gd.start();
        const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setEmoji('✔').setCustomId('0').setLabel("Yes").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setEmoji('✖').setCustomId('1').setLabel("No").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setEmoji('🇵').setCustomId('3').setLabel("Probably").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setEmoji('ℹ').setCustomId('2').setLabel("Don't Know").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setEmoji('🇳').setCustomId('4').setLabel("Probably Not").setStyle(ButtonStyle.Primary)
        );
        const msg = await channel.send({embeds: [new RichEmbed().setTitle("Akinator").setDescription(`Question #${gd.currentStep+1}`).addField(gd.question,`Progress: ${Math.floor(gd.progress)}%`)], components: [actions]})
        let collector = msg.createMessageComponentCollector({filter: i => i.user.id == member.id, idle: 60000});

        collector.on('collect', async i => {
            let reaction = parseInt(i.customId);
            await gd.step(reaction);
            if (gd.progress < 85) {
                await i.update({embeds: [new RichEmbed().setTitle("Akinator").setDescription(`Question #${gd.currentStep + 1}`).addField(gd.question, `Progress: ${Math.floor(gd.progress)}%`)]});
            } else {
                await gd.win();
                i.update({embeds: [new RichEmbed().setTitle("Akinator").setDescription("").addField(`${gd.answers[0].name}`, `${gd.answers[0].description}`, true).addField(`Questions: ${gd.currentStep+1}`, `certainty: ${Math.floor(gd.answers[0].proba * 100)}%`).setImage(gd.answers[0].absolute_picture_path)], components: []})
                collector.stop("win");
            }
        });

        collector.on('end', (e,r) => {
           if (r !== "win") {
               msg.edit({embeds: [new RichEmbed().setTitle("Akinator").setDescription("Akinator timed out waiting for reaction. progress lost!")]});
           }
        });
    }   
}

export const plugin = new WebPlugin<AkinatorData>("Akinator", "Akinator game in discord.", {});
plugin.addCommand(new Akinator());