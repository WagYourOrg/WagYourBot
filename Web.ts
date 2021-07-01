import {WagYourBotWeb} from "./web/WagYourBotWeb";
import {existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync} from "fs";
import {PluginSlug} from "./Structures";


function registerPlugins(): PluginSlug[] {
    if (!existsSync("./plugins")) {
        mkdirSync("./plugins");
    }
    const folders = readdirSync("./plugins");
    const plugins: PluginSlug[] = [];
    for (const plugin of folders) {
        plugins.push(plugin);
        //console.log(plugin);
        if (!existsSync(`./web/views/plugins/${plugin}`)) {
            symlinkSync(realpathSync(`./plugins/${plugin}`), `./web/views/plugins/${plugin}`, process.cwd().match(/^[A-Z]:\\/) ? "junction" : "file");
        }
    }
    return plugins;
}

new WagYourBotWeb(registerPlugins(), "174312969386196993").listen(5000);