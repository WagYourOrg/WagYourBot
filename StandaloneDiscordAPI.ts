import {WagYourBotWeb} from "./web/WagYourBotWeb";
import fetch from "node-fetch";

function hexPad(num: number, count: number) {
    const o = [];
    for (let a = 0; a < count - num.toString(16).length; a++) o.push('0');
    return o.join('') + num.toString(16);
}

export class StandaloneDiscordAPI {

    static async getGuildRoles(guildID: string, clientID: string, handler: WagYourBotWeb) {
        const token = handler.database.getGuild(guildID, handler.defaultPrefix);
        const resp = await fetch(`https://discord.com/api/guilds/${guildID}/roles`, {headers: {"Authorization": `Bot ${token}`}});
        if (resp.status !== 200) throw new Error(`discord api returned: ${resp.statusText}`);
        const data = <{name: string, color: number, position: number, id: string}[]>await resp.json();
        const roles: {[key: string]: {name: string, color: string, position: number}} = {}
        for (const role of data) {
            roles[role.name == "@everyone" ? role.name : role.id] = {name: role.name, color: hexPad(role.color, 6), position:role.position};
        }
        return roles;
    }
}