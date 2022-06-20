import { CommandTree, RichEmbed } from "../../Handler";
import { Message } from "discord.js";
import { WeatherData, WeatherResponse } from "./WeatherCommon";
import { Parser } from "xml2js";
import { WebPlugin } from "../../../web/WagYourBotWeb";
import fetch from "node-fetch";

const parser = new Parser();

function parseString(data: string) {
    return new Promise<any>((res, rej) => {
        parser.parseString(data, (err: Error | null, resp: any) => {
            if (err) {
                rej(err);
            }
            res(resp);
        });
    })
}

class Weather extends CommandTree<WeatherData> {

    constructor() {
        super("weather", [], "gets the weather", true, true);
    }

    buildCommandTree(): void {
        this.then("location", {type: /.+/}, async (args, remainingContent, member, guild, channel, message, handler) => {
            const weather = await fetch(`https://weather.service.msn.com/find.aspx?src=msn&weadegreetype=C&culture=en&weasearchstr=${encodeURIComponent(args.location)}`);
            let response: Message | null = null;
            let text = await weather.text();
            if (weather.status === 200 && text.trim().startsWith("<")) {
                const resp: WeatherResponse = await parseString(text);
                const location = resp.weatherdata.weather[0];
                const embed = new RichEmbed().setTitle(`Weather: ${location.current[0].$.skytext}`)
                    .setURL(location.$.url)
                    .setThumbnail(`${location.$.imagerelativeurl}law/${location.current[0].$.skycode}.gif`);

                if (location.$.alert.length) {
                    embed.setDescription(`⚠️ ${location.$.alert} ⚠️`);
                }

                embed.addField(location.$.weatherlocationname, `${Math.abs(parseFloat(location.$.lat))}°${parseFloat(location.$.lat) > 0 ? "N" : "S"}, ${Math.abs(parseFloat(location.$.long))}°${parseFloat(location.$.lat) > 0 ? "W" : "E"}`)

                const tempC = parseInt(location.current[0].$.temperature);
                const tempF = Math.round(tempC*1.8+32);
                const tempCFeel = parseInt(location.current[0].$.feelslike);
                const tempFFeel = Math.round(tempCFeel*1.8+32);

                embed.addField("Temperature",
                    `Actual: ${tempC}°C (${tempF}°F)\nFeels Like: ${tempCFeel}°C (${tempFFeel}°F)`, true);

                embed.addField("Humidity", `${location.current[0].$.humidity}%`, true);
                embed.addField("Wind", location.current[0].$.winddisplay, true);

                embed.addField("Observed At", location.current[0].$.observationtime);

                response = await channel.send({embeds: [embed]});
            } else {
                response = await channel.send({embeds: [new RichEmbed().setTitle("Weather").setDescription(`location \`${args.location}\` failed to parse \n\n${text}`)]});
            }
            if (guild && (await handler.database.getGuildPluginData(guild.id, this.plugin.name, this.plugin.data)).autoDelete) {
                setTimeout(response.delete, 20 * 1000);
                setTimeout(message.delete, 20 * 1000);
            }
        })
    }
}

class WeatherDelete extends CommandTree<WeatherData> {
    constructor() {
        super("weatherautodelete", [], "whether weather messages should delete themselves after a time.");
    }

    buildCommandTree() {
        this.then("enable", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            await handler.database.setGuildPluginData(guild.id, this.plugin.name, {autoDelete: true});
            channel.send({embeds: [new RichEmbed().setTitle("Weather AutoDelete").setDescription("`enabled`")]});
        }).or("disable", {}, async (args, remainingContent, member, guild, channel, message, handler) => {
            await handler.database.setGuildPluginData(guild.id, this.plugin.name, {autoDelete: false});
            channel.send({embeds: [new RichEmbed().setTitle("Weather AutoDelete").setDescription("`disabled`")]});
        })
        .defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {
            const data = await handler.database.getGuildPluginData(<string>guild?.id, this.plugin.name, this.plugin.data);
            await handler.database.setGuildPluginData(<string>guild?.id, this.plugin.name, {autoDelete: !data.autoDelete});
            channel.send({embeds: [new RichEmbed().setTitle("Weather AutoDelete").setDescription(`\`${data.autoDelete ? "disabled" : "enabled"}\``)]});
        });
    }
}

export const plugin = new WebPlugin("Weather", "Display weather queries", {autoDelete: false});
plugin.addCommand(new Weather());
plugin.addCommand(new WeatherDelete());