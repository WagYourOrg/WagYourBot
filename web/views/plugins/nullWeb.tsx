import React from "react";
import PluginBase from "../PluginBase";
import {NullData} from "../../WagYourBotWeb";


export default class NullWeb extends PluginBase {

    style(): JSX.Element | JSX.Element[] | undefined {
        return [<link rel= "stylesheet" href= "https://cdn.jsdelivr.net/npm/pretty-checkbox@3.0/dist/pretty-checkbox.min.css" key= {0}/>, <style type= "text/css" key= {1}>
            {`
                .plugins {
                    margin-top: 20px;
                }
                
                .prefix {
                    display: inline-block;
                    background-color: #5C5C5C;
                    margin: 30px 20px 0px;
                    padding: 20px;
                    width: 205px;
                    color: white;
                }
                
                .prefix input {
                    border-radius: 10px;
                    background-color: #888888;
                    border-style: none;
                    padding: 5px;
                }
                
                .plugin {
                    display: inline-block;
                    background-color: #5C5C5C;
                    margin: 30px 20px 0px;
                    padding: 20px;
                    width: 205px;
                }
                
                
                .plugin a {
                    padding-left: 10px;
                    text-decoration: none;
                    color: white;
                }
                
                .plugin a:hover {
                    color: #DDDDDD;
                }
            `}
        </style>]
    }

    private genPlugins(): JSX.Element[] {
        const plugins: JSX.Element[] = [];
        for (const plugin of Object.values(this.props.web.plugins)) {
            if (plugin.name === "null") continue;
            plugins.push(<div className= "plugin" id= {plugin.name} key= {plugins.length}>
                <div className= "pretty p-switch p-fill">
                    <input name= {plugin.name} type= "checkbox" defaultChecked= {(this.props.pluginData.data as NullData).enabled.includes(plugin.name)} disabled= {plugin.name === "Default" && (this.props.pluginData.data as NullData).enabled.includes(plugin.name)} />
                    <div className= "state p-success"><label /></div>
                </div>
                <a href= {`/dashboard/${this.props.guildID}/${plugin.name}`}>
                    {plugin.name}
                    <p className= "description">
                        {plugin.description}
                    </p>
                </a>
            </div>);

        }
        return plugins;
    }

    pluginContent(): JSX.Element | JSX.Element[] | undefined {
        return [
            <div className= "plugins" key= {0}>
                <div className= "prefix">
                    Prefix:
                    <input type= "text" id= "prefix" name= "prefix" defaultValue= {(this.props.pluginData.data as NullData).prefix} />
                </div>
                {this.genPlugins()}
            </div>,
            <datalist id= "roles" key= {1}/>
        ];
    }
}