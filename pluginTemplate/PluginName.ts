import { CommandTree } from "../bot/Handler";
import { Plugin } from "../bot/Handler";
import {PluginData} from "./PluginName.common";

class CommandTemplate extends CommandTree<PluginData> {
    constructor() {
        super("commandtemplate", ["command alias"], "description");
    }

    buildCommandTree() {
        this.then("exampletree", {}, async (args, remainingContent, member, guild, channel, message, handler) => {

        }).defaultEval(async (args, remainingContent, member, guild, channel, message, handler) => {

        });
    }
}

const plugin = new Plugin<PluginData>("PluginTemplate", "template plugin", {});
plugin.addCommand(new CommandTemplate());