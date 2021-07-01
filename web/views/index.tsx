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

                <script defer src="/static/js/index.js"></script>
            </head>
            <body>
                {new Topbar(this.props).render()}
                {new Footer(this.props).render()}

            </body>
        </html>
    }
}