import React from "react";
import {Component} from "react";
import Topbar, {TopbarProps} from "./globals/topbar";
import Footer, {FooterProps} from "./globals/footer";
import {GuildInfo} from "passport-discord";

export interface PluginProps extends TopbarProps, FooterProps {
    adminGuilds: GuildInfo[],
    guildID?: string
}

export default abstract class PluginBase extends Component<PluginProps> {

    abstract style(): JSX.Element | undefined;

    render() {
        return <html>
            <head>
                <title>WagYourBot</title>

                <link rel="stylesheet" type="text/css" href="/static/css/dashboard.css" />
                <link rel="stylesheet" type="text/css" href="/static/css/topbar.css" />
                <link rel="stylesheet" type="text/css" href="/static/css/footer.css" />
                {this.style()}

                <script defer src="/static/js/dashboard.js"></script>
            </head>
            <body>
                {new Topbar(this.props).render()}
                <div className="content">
                    <div className="sidebar">
                        <div id="guilds">
                            {this.props.adminGuilds.map(e =>
                                <a className={`guildSelector${e.id === this.props.guildID ? "currentGuild" : ""}`} href={`/dashboard/${e.id}/null`}>
                                    {e.icon ? <img src={`https://cdn.discordapp.com/icons/${e.id}/${e.icon}.webp?size=128`} width="50px" height="50px" /> : []}
                                    {e.name}
                                </a>
                            )}
                        </div>
                    </div>

                </div>
                {new Footer(this.props).render()}
            </body>
        </html>;
    }
}