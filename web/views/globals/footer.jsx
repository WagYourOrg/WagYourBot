"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_2 = require("react");
class Footer extends react_2.Component {
    render() {
        return <div className="footer">
            <h3>
                <div id="left">WagYourBot | Wagyourtail 2021</div>
                <div id="right">
                    {this.props.loginStatus ? [<a href="/logout" key={0}>Logout</a>, " | "] : ""}
                    <a href="https://github.com/Wagyourtail/WagYourBot">Github</a>
                </div>
            </h3>
        </div>;
    }
}
exports.default = Footer;
