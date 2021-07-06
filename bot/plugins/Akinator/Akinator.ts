import { GuildMember, User, Guild, TextChannel, DMChannel, NewsChannel, Message, MessageReaction } from "discord.js";
import { Command, Handler, Plugin, RichEmbed } from "../../Handler";
import { Aki } from "aki-api.ts";
import {AkinatorData} from "./Akinatorcommon";
import {WebPlugin} from "../../../web/WagYourBotWeb";

class Akinator extends Command<AkinatorData> {
    constructor() {
        super("akinator", [], "akinator", "starts a game of akinator", true, true);
    }
    
    async waitForReaction(channel: TextChannel | DMChannel | NewsChannel, author: GuildMember | User, msg: Message) {
        const sel: {[key: string]: number} = {"✔":0,"✖":1,"ℹ":2,"🇵":3,"🇳":4};
        const reaction: MessageReaction | null = [...await (await msg.awaitReactions((r,u) => u.id === author.id && Object.keys(sel).includes(r.emoji.name), {idle: 60000, max: 1})).values()][0];
        if (reaction) {
            reaction.users.remove(author.id);
            return sel[reaction.emoji.name];
        } else {
            return -1;
        }
    }

    async message(content: string, member: GuildMember | User, guild: Guild | null, channel: TextChannel | DMChannel | NewsChannel, message: Message, handler: Handler): Promise<void> {
        const gd = new Aki('en');
        await gd.start();
        const msg = await channel.send(new RichEmbed().setTitle("Akinator").setDescription(`Question #${gd.currentStep+1}`).addField(gd.question,`Progress: ${Math.floor(gd.progress)}%`).addField("Options","✔:Yes	✖:No	ℹ:Don't Know	🇵:Probably	🇳:Probably Not", true))
        msg.react("✔").then(()=>{msg.react("✖").then(()=>{msg.react("ℹ").then(()=>{msg.react("🇵").then(()=>{msg.react("🇳")})})})});
        do {
            let reaction = await this.waitForReaction(channel, member, msg);
            if (reaction == -1) break;
            await gd.step(reaction);
            await msg.edit(new RichEmbed().setTitle("Akinator").setDescription(`Question #${gd.currentStep+1}`).addField(gd.question, `Progress: ${Math.floor(gd.progress)}%`).addField("Options", "✔:Yes	✖:No	ℹ:Don't Know	🇵:Probably	🇳:Probably Not", true))
        } while (gd.progress < 85);
        if (gd.progress >= 85) {
			await gd.win();
			msg.edit(new RichEmbed().setTitle("Akinator").setDescription("").addField(`${gd.answers[0].name}`, `${gd.answers[0].description}`, true).addField(`Questions: ${gd.currentStep+1}`, `certainty: ${Math.floor(gd.answers[0].proba * 100)}%`).setImage(gd.answers[0].absolute_picture_path))
            msg.reactions.removeAll();
        } else {
            msg.edit(new RichEmbed().setTitle("Akinator").setDescription("Akinator timed out waiting for reaction. progress lost!"));
            msg.reactions.removeAll();
        }
    }   
}

export const plugin = new WebPlugin<AkinatorData>("Akinator", "Akinator game in discord.", {});
plugin.addCommand(new Akinator());