import React from "react";
import {Component} from "react";
import Topbar, {TopbarProps} from "./globals/topbar";
import Footer, {FooterProps} from "./globals/footer";
import {GuildInfo} from "passport-discord";
import { PluginData, WagYourBotWeb, WebPlugin } from "../WagYourBotWeb";
import {Command} from "../../bot/Handler";

export interface PluginProps extends TopbarProps, FooterProps {
    adminGuilds: GuildInfo[];
    guildID?: string;
    web: WagYourBotWeb;
    pluginData: PluginData;
    plugin: WebPlugin<any>;
}

export default abstract class PluginBase<T extends PluginProps = PluginProps> extends Component<T> {

    style(): JSX.Element | JSX.Element[] | undefined {
        return undefined;
    }

    private createAliases(command: Command<any>): JSX.Element[] {
        const aliases: JSX.Element[] = [];
        for (const alias of this.props.pluginData.aliases[command.name] ?? command.aliases) {
            aliases.push(<div className= "input" key= {aliases.length}>
                <input className= "alias" type= "text" name= {`${command.name}.aliases`} defaultValue= {alias} data-lpignore= "true" />
                <input type= "button" className= "button" value= "x" data-onclick= "this.parentNode.remove()" />
            </div>);
        }
        aliases.push(<div className= "input newAlias" key= {aliases.length}>
            <input className= "alias" type= "text" name= {`${command.name}.aliases`} data-lpignore= "true" />
            <input type= "button" className= "button" value= "+" data-onclick= {`newAlias('${command.name}', this)`} />
        </div>);
        return aliases;
    }

    private createPerms(command: Command<any>): JSX.Element[] {
        const perms: JSX.Element[] = [];
        for (const perm of this.props.pluginData.perms[command.name] ?? command.perms) {
            perms.push(<div className= "input" style= {{border: "1px solid green"}} key= {perms.length}>
                <input className= "perm" type= "text" name= {`${command.name}.perms`} list= "roles" defaultValue= {`@${this.props.pluginData.roles[perm]?.name.replace('@', '')}`} data-onkeyup= "changeColor(this)" data-onchange= "changeColor(this)" data-onpaste= "changeColor(this)" data-lpignore= "true" style={{color: `#${this.props.pluginData.roles[perm]?.color}`}} />
                <input type= "button" className= "button" value= "x" data-onclick= "this.parentNode.remove()" />
            </div>);
        }
        perms.push(<div className= "input newPerm" key= {perms.length}>
            <input className= "perm" type= "text" name= {`${command.name}.perms`} list= "roles" data-onkeyup= "changeColor(this)" data-onchange= "changeColor(this)" data-onpaste= "changeColor(this)" data-lpignore= "true" />
            <input type= "button" className= "button" value= "+" data-onclick= {`newPerm('${command.name}', this)`} />
        </div>);
        return perms;
    }

    pluginContent(): JSX.Element | JSX.Element[] | undefined {
        if (this.props.guildID === undefined) return undefined;
        const commands: JSX.Element[] = [];
        for (const command of this.props.plugin.commands.sort((a, b) => a.name.localeCompare(b.name))) {
            commands.push(<div className= "command" id= {command.name} key= {commands.length}>
                <h2>{command.name}</h2>
                <div className= "aliases">Aliases
                    {this.createAliases(command)}
                </div>
                <div className= "perms">Perms
                    {this.createPerms(command)}
                </div>
            </div>)
        }

        return <div className= "commands">
            {commands}
            <datalist id= "roles">
                {this.genRoleDataList()}
            </datalist>
        </div>;
    }

    private genRoleDataList(): JSX.Element[] {
        const roles: JSX.Element[] = [];
        for (const [id, role] of Object.entries(this.props.pluginData.roles)) {
            roles.push(<option style= {{color: `#${role?.color}`}} key= {roles.length}>
                {`@${role?.name.replace('@', '')}`}
            </option>)
        }
        return roles;
    }

    render() {
        return <html>
            <head>
                <title>WagYourBot</title>

                <link rel="stylesheet" type="text/css" href="/static/css/dashboard.css" />
                <link rel="stylesheet" type="text/css" href="/static/css/topbar.css" />
                <link rel="stylesheet" type="text/css" href="/static/css/footer.css" />
                {this.style()}

                <script defer src="/static/js/dashboard.js" />
            </head>
            <body>
                {new Topbar(this.props).render()}
                <div className= "content">
                    <div className= "sidebar">
                        <div id= "guilds">
                            {this.props.adminGuilds.map((e, i) =>
                                <a className={`guildSelector${e.id === this.props.guildID ? "currentGuild" : ""}`} href= {`/dashboard/${e.id}/null`} key= {i}>
                                    {e.icon ? <img src= {`https://cdn.discordapp.com/icons/${e.id}/${e.icon}.webp?size=128`} width= "50px" height= "50px"  alt=""/> : []}
                                    {e.name}
                                </a>
                            )}
                        </div>
                        <div id= "addGuild">
                            <a className= "guildSelector" href= "https://discordapp.com/api/oauth2/authorize?client_id=520769818870415380&scope=bot&permissions=8" target= "_blank">
                                <img src= "/static/images/discord.png" width= "50px" height= "50px"  alt= ""/>
                                Add A Discord
                            </a>
                        </div>
                    </div>
                    <div className= "main">
                        <div className= "saveBar">
                            <h1 className= "pluginName">{this.props.plugin.name}</h1>
                            <div className= "description">
                                {this.props.plugin.description}
                            </div>
                            <input id= "reset" type= "button" data-onclick= "location.reload()" value= "Reset"/>
                            <input id= "submit" type= "submit" form= "pluginContent" value= "Apply"/>
                            <div />
                        </div>
                        <form id="pluginContent" className= "pluginContent" method= "post">
                            {this.pluginContent()}
                        </form>
                    </div>
                </div>
                {new Footer(this.props).render()}
                <script type="text/javascript" dangerouslySetInnerHTML={{ __html:
                        `[...document.getElementsByTagName('input')].forEach(e => {
                        e.setAttribute('onclick', e.getAttribute('data-onclick'));
                        e.setAttribute('onkeyup', e.getAttribute('data-onkeyup'));
                        e.setAttribute('onchange', e.getAttribute('data-onchange'));
                        e.setAttribute('onpaste', e.getAttribute('data-onpaste'));
                    })`
                }} >
                </script>
            </body>
        </html>;
    }
}