import { existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync } from "fs";
import { Handler } from "./bot/Handler";

class WagYourBot extends Handler {
    constructor() {
        super("174312969386196993");

        this.on("ready", () => {
            this.user?.setPresence({activity: { name: "bot.wagyourtail.xyz"}, status: 'online'});
            console.log("ready");
        });
    }

    registerPlugins(): void {
        if (!existsSync("./plugins")) {
            mkdirSync("./plugins");
        }
        const folders = readdirSync("./bot/plugins");
        for (const plugin of folders) {
            this.registerPlugin(require(`./bot/plugins/${plugin}/${plugin}.js`).plugin);
        }
    }
}

const bot = new WagYourBot();

bot.login().catch(console.error);