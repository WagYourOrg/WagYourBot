"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_2 = require("react");
class Topbar extends react_2.Component {
    render() {
        return <div className="topbar">
            <a href="/" id="title"><b>
                WagYourBot
            </b></a>
            <div id="guildLength">
                Serving {this.props.guildLength.toString()} guilds.
            </div>
            {this.props.loginStatus ?
                <a id="login" href="/dashboard">
                    <img src={this.props.userAvatar} width="50px" height="50px"/>
                    {this.props.userName}
                </a>
                :
                    <a id="login" href="/login">
                    login
                </a>}
        </div>;
    }
}
exports.default = Topbar;
