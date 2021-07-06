import React from "react";
import PluginBase, { PluginProps } from "./PluginBase";

export default class NoGuild extends PluginBase {
    pluginContent(): JSX.Element | JSX.Element[] | undefined {
        return <div className="description">
            You are not an admin in any guilds the bot is a member of. You can add the bot to a discord using the link on the bottom left.
        </div>;
    }
}