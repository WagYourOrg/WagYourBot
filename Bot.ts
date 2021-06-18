import { existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync } from "fs";
import { Handler } from "./Handler";

class WagYourBot extends Handler {
    constructor() {
        super("!!");

        this.on("ready", () => {
            this.user?.setPresence({activity: { name: "bot.wagyourtail.xyz"}, status: 'online'});
            console.log("ready");
        });
    }

    registerPlugins(): void {
        if (!existsSync("./plugins")) {
            mkdirSync("./plugins");
        }
        const folders = readdirSync("./plugins");
        for (const plugin of folders) {
            this.registerPlugin(require(`./plugins/${plugin}/${plugin}.js`).plugin);
            //console.log(plugin);
            if (existsSync(`./plugins/${plugin}/web/views`) && !existsSync(`./views/plugins/${plugin}`)) {
                symlinkSync(realpathSync(`./plugins/${plugin}/web/views`), `./views/plugins/${plugin}`);
            }
        }
    }   
}

const bot = new WagYourBot();

bot.database.getClientToken("174312969386196993").then(token => {
    bot.login(token);
}).catch(console.error);