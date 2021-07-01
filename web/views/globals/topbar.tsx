import React from "react";
import {Component} from "react";

export interface TopbarProps {
    loginStatus: boolean
    guildLength: number
    userAvatar?: string
    userName?: string
}

export default class Topbar extends Component<TopbarProps> {
    render() {
        return <div className="topbar">
            <a href="/" id="title"><b>
                WagYourBot
            </b></a>
            <div id="guildLength">
                Serving {this.props.guildLength.toString()} guilds.
            </div>
            {
            this.props.loginStatus ?
                <a id="login" href="/dashboard">
                    <img src={this.props.userAvatar} />
                    {this.props.userName}
                </a>
            :
                <a id="login" href="/login">
                    login
                </a>
            }
        </div>
    }
}