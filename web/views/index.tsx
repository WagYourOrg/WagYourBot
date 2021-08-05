import React from "react";
import {Component} from "react";
import Topbar, {TopbarProps} from "./globals/topbar";
import Footer, {FooterProps} from "./globals/footer";

export interface IndexProps extends TopbarProps, FooterProps {
}

export default class Index extends Component<IndexProps> {
    render() {
        return <html>
            <head>
                <title>WagYourBot</title>
                <link rel="stylesheet" type="text/css" href="/static/css/index.css" />
                <link rel="stylesheet" type="text/css" href="/static/css/topbar.css" />
                <link rel="stylesheet" type="text/css" href="/static/css/footer.css" />

                <script defer src="/static/js/index.js" />
            </head>
            <body>
                {new Topbar(this.props).render()}
                <div className= "content">
                    <h1>Automate Your Discord Server</h1>
                    <h2>Have a dynamic bot with just the features you need!</h2>
                    <div className= "inline">
                        <a id= "add" href= "https://discordapp.com/api/oauth2/authorize?client_id=174312969386196993&scope=bot&permissions=8" target= "_blank">
                            <img src= "/static/images/discord.png" height= "50px" width= "50px"/>
                            Add To Discord
                        </a>
                    </div>
                    {/* @ts-ignore */}
                    <iframe src= "https://discordapp.com/widget?id=646759800050286612&theme=dark" width= "350" height= "350" allowtransparency= "true" frameBorder= "0" />
                </div>
                {new Footer(this.props).render()}
            </body>
        </html>
    }
}