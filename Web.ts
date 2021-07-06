import {WagYourBotWeb} from "./web/WagYourBotWeb";
import {existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync} from "fs";
import {PluginSlug} from "./Structures";


function registerPlugins(): PluginSlug[] {
    if (!existsSync("./plugins")) {
        mkdirSync("./plugins");
    }
    const folders = readdirSync("./bot/plugins");
    const plugins: PluginSlug[] = [];
    for (const plugin of folders) {
        plugins.push(plugin);
    }
    return plugins;
}

new WagYourBotWeb(registerPlugins(), "174312969386196993").listen(5000);