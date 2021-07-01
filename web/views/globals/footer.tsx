import React from "react";
import {Component} from "react";

export interface FooterProps {
    loginStatus: boolean
}

export default class Footer extends Component<FooterProps> {
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