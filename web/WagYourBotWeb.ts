import express, {Express, NextFunction, Request, Response} from "express";
import {setupReactViews} from "express-tsx-views";
import { resolve } from "path";
import passport from "passport";
import {PluginAliases, PluginPerms, PluginSlug} from "../Structures";
import {SQLDatabase} from "../Database";
import {Profile, Strategy} from "passport-discord";
import session from "express-session";
import {randomBytes} from "crypto";
import {IndexProps} from "./views";
import {Plugin} from "../bot/Handler";
import {StandaloneDiscordAPI} from "../StandaloneDiscordAPI";

type BetterResponse = Response & {
    render<T>(view: string, options?: T, callback?: (err: Error, html: string) => void): void;
}

export class WagYourBotWeb {
    readonly app = express();
    readonly database;
    readonly defaultPrefix = "!!";
    readonly clientId: string;
    readonly plugins: {[key: string]: WebPlugin<any>} = {};
    readonly owner = "100748674849579008";

    constructor(plugins: PluginSlug[], clientId: string) {
        for (const pluginName of plugins) {
            const plugin: unknown = require(`../plugins/${pluginName}/${pluginName}.js`).plugin;
            if (plugin instanceof WebPlugin) {
                //force non-readonly
                (<{fileName: string}>plugin).fileName = pluginName;
                this.plugins[plugin.name] = plugin;
            } else if (plugin instanceof Plugin) {
                throw new Error(`"${plugin.name}" does not support web.`);
            } else {
                throw new Error(`Could not find plugin in plugin folder "${pluginName}".`);
            }
        }
        this.plugins["null"] = require('./views/plugins/null/null').plugin;
        this.database = new SQLDatabase(Object.keys(this.plugins));
        this.clientId = clientId;
        this.setup();
    }

    setup() {
        passport.serializeUser((user, done) => {
            done(null, user);
        });

        passport.deserializeUser((obj: Express.User, done) => {
            done(null, obj);
        });

        setupReactViews(this.app, {
            viewsDirectory: resolve(__dirname, 'views'),
            prettify: true
        });

        this.database.getClientSecret(this.clientId).then(secret => {
            passport.use(new Strategy({
                clientID: this.clientId,
                clientSecret: secret,
                callbackURL: 'https://bot.wagyourtail.xyz/callback',
                scope: ['identify', 'email', 'guilds']
            }, (accessToken, refreshToken, profile, done) => {
                process.nextTick(() => {
                    return done(null, profile);
                });
            }));
        });

        this.app.use(session({
            secret: randomBytes(7).toString('base64'),
            resave: false,
            saveUninitialized: false
        }));

        this.app.use(passport.initialize());
        this.app.use(passport.session());
        this.app.use('/static', express.static(resolve(__dirname, 'static')));

        this.app.param('guildID', (req, res, next, guildID) => {
            req.params.guildID = guildID;
            next();
        });

        this.app.param('pluginSlug', (req, res, next, pluginSlug) => {
            req.params.pluginSlug = pluginSlug;
            next();
        });

        this.app.get('/login', passport.authenticate('discord', { scope: ['identify', 'email', 'guilds'] }));

        this.app.get('/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
                res.redirect('/dashboard')
        });

        this.app.get('/logout', (req, res) => {
            req.logout();
            res.redirect('/');
        });

        this.app.get('/', async (req, res: BetterResponse) => {
            res.render<IndexProps>('index', {
                guildLength: await this.database.guildLength(),
                loginStatus: !!req.user,
                userAvatar: req.user ? `https://cdn.discordapp.com/avatars/${(<Profile>req.user).id}/${(<Profile>req.user).avatar}.png` : undefined,
                userName: req.user ? (<Profile>req.user).username : undefined
            });
        });

        this.app.get('/dashboard', this.checkAuth, async (req, res) => {
            const guilds = (<Profile>req.user).id === this.owner ? (<Profile>req.user).guilds : (<Profile>req.user).guilds?.filter(guild => {return guild.permissions & 8});
            const botGuilds = await this.database.getGuilds();
            const adminGuilds = guilds?.filter(guild => botGuilds.includes(guild.id));
            res.redirect(`/dashboard/${adminGuilds?.[0] ? adminGuilds[0].id : "null"}/null`);
        });

        this.app.post('/dashboard/:guildID/:pluginSlug', this.checkAuth, async (req, res) => {
            const guilds = (<Profile>req.user).id === this.owner ? (<Profile>req.user).guilds : (<Profile>req.user).guilds?.filter(guild => {return guild.permissions & 8});
            const botGuilds = await this.database.getGuilds();
            const adminGuilds = guilds?.filter(guild => botGuilds.includes(guild.id));

            if (Object.keys(this.plugins).includes(req.params.pluginSlug) && adminGuilds?.filter(g => g.id === req.params.guildID).length) {
                await (<WebPlugin<any>>this.plugins[req.params.pluginSlug]).put(req.params.guildID, req.body, this);
                res.redirect(`/dashboard/${req.params.guildID}/${req.params.pluginSlug}`);
            } else {
                res.redirect("/dashboard");
            }
        });

        this.app.get('/dashboard/:guildID/:pluginSlug', this.checkAuth, async (req, res: BetterResponse) => {
            const guilds = (<Profile>req.user).id == "100748674849579008" ? (<Profile>req.user).guilds : (<Profile>req.user).guilds?.filter(guild => {return guild.permissions & 8});
            const botGuilds = await this.database.getGuilds();
            const adminGuilds = guilds?.filter(guild => botGuilds.includes(guild.id));
            if (Object.keys(this.plugins).includes(req.params.pluginSlug) && adminGuilds?.filter(g => g.id == req.params.guildID).length) {
                const pluginData = (<WebPlugin<any>>this.plugins[req.params.pluginSlug]).get(req.params.guildID, this);
                res.render(`plugins/${this.plugins[req.params.pluginSlug].fileName}/${this.plugins[req.params.pluginSlug].fileName}.Web`, {
                    guildLength: await this.database.guildLength(),
                    pluginData: pluginData,
                    guildID: req.params.guildID,
                    pluginSlug:req.params.pluginSlug,
                    adminGuilds: adminGuilds,
                    loginStatus: !!req.user,
                    userAvatar: req.user ? `https://cdn.discordapp.com/avatars/${(<Profile>req.user).id}/${(<Profile>req.user).avatar}.png` : undefined,
                    userName: req.user ? (<Profile>req.user).username : undefined
                });
            } else if (req.params.guildID == "null") {
                res.render("noguild", {
                    guildLength: await this.database.guildLength(),
                    pluginData: {aliases:{}},
                    guildID: req.params.guildID,
                    pluginSlug:req.params.pluginSlug,
                    adminGuilds: adminGuilds,
                    loginStatus: !!req.user,
                    userAvatar: req.user ? `https://cdn.discordapp.com/avatars/${(<Profile>req.user).id}/${(<Profile>req.user).avatar}.png` : undefined,
                    userName: req.user ? (<Profile>req.user).username : undefined
                })
            } else {
                res.redirect("/dashboard");
            }

        });
    }

    checkAuth(req: Request, res: Response, next: NextFunction) {
        if (req.isAuthenticated()) return next();
        res.redirect('/');
    }

    async listen(port: number) {
        this.app.listen(port);
    }
}

export class WebPlugin<T> extends Plugin<T> {
    readonly fileName!: string;

    constructor(name: PluginSlug="", description: string="", defaultData: T) {
        super(name, description, defaultData);
    }

    async get(guildId: string, handler: WagYourBotWeb): Promise<{aliases: PluginAliases, perms: PluginPerms, roles: {[key: string]: {name: string, color: string, position: number}}}> {
        const guild = await handler.database.getGuild(guildId, handler.defaultPrefix);
        const data = <{aliases: PluginAliases, perms: PluginPerms, roles: {[key: string]: {name: string, color: string, position: number}}}>await handler.database.getGuildPluginAliasesAndPerms(guildId, this.name, this.aliases, this.perms);
        data.roles = await StandaloneDiscordAPI.getGuildRoles(guildId, <string>guild.clientID, handler);
        return data;
    }

    async put(guildId: string, data: {[key: string]: string[]}, handler: WagYourBotWeb): Promise<void> {
        const guild = await handler.database.getGuild(guildId, handler.defaultPrefix);
        const roles = StandaloneDiscordAPI.getGuildRoles(guildId, <string>guild.clientID, handler);
        const rolesByName: {[roleid: string]: string} = {};
        for (const [id, val] of Object.entries(roles)) {
            rolesByName[val.name.replace('@', '')] = id;
        }
        const commands = Object.keys(data).filter(d => d.endsWith("aliases")).map(d => d.replace(".aliases", ""));
        const perms: PluginPerms = {};
        const aliases: PluginAliases = {};
        for (const command of commands) {
            aliases[command] = (<string[]>[]).concat(<string[]>(data[`${command}.aliases`])).map(d => d.replace(/\s/g, "")).filter(d => d != "");
            perms[command] = (<string[]>[]).concat(<string[]>(data[`${command}.perms`])).map(d => rolesByName[d.replace('@', '')]).filter(d => d);
        }
        handler.database.setGuildPluginAliases(guildId, "ChannelFilter", aliases);
        handler.database.setGuildPluginPerms(guildId, "ChannelFilter", perms);
    }
}