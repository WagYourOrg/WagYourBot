import { createPool } from "mariadb"
import { PluginAliases, AbstractPluginData, PluginPerms, Database, PluginSlug } from "./Structures";

export class SQLDatabase implements Database {
    readonly mdb = createPool({host: "127.0.0.1", user: "wagyourbot", password: "123456", connectionLimit: 5, database: "WagYourBot", supportBigInt: true});

    constructor(plugins: PluginSlug[]) {
        this.setup(plugins).catch(e => {throw e});
    }

    private async setup(plugins: PluginSlug[]) {
        const conn = await this.mdb.getConnection();
        try {
            conn.query("CREATE TABLE IF NOT EXISTS Secrets(ClientID BigInt PRIMARY KEY, Token TINYTEXT, Secret TINYTEXT);");
            conn.query("CREATE TABLE IF NOT EXISTS Guilds(GuildID BigInt PRIMARY KEY, Plugins JSON, Prefix TINYTEXT);");
            conn.query("CREATE TABLE IF NOT EXISTS MemberRank(MidGid VARCHAR(255) PRIMARY KEY, MemberID BIGINT, GuildID BIGINT, Score INT, LastMsg INT, FOREIGN KEY(GuildID) REFERENCES Guilds(GuildID));");
            for (const plugin of plugins) {
                conn.query(`CREATE TABLE IF NOT EXISTS Plugin${plugin}(GuildID BIGINT PRIMARY KEY, Aliases JSON, Perms JSON, Data JSON, FOREIGN KEY(GuildID) REFERENCES Guilds(GuildID))`);
            }
        } finally {
            conn.release();
        }
    }
 
    async getClients(): Promise<string[]> {
        const conn = await this.mdb.getConnection();
        try {
            return (<{ClientID: string}[]>await conn.query("SELECT ClientID FROM Secrets")).map(e => e.ClientID);
        } finally {
            conn.release();
        }
    }

    async getClientToken(clientID: string): Promise<string> {
        const conn = await this.mdb.getConnection();
        try {
            return (<{Token: string}[]>await conn.query("SELECT Token FROM Secrets WHERE ClientID=?", [clientID])).map(e => e.Token)[0];
        } finally {
            conn.release();
        }
    }

    async getClientSecret(clientID: string): Promise<string> {
        const conn = await this.mdb.getConnection();
        try {
            return (<{Secret: string}[]>await conn.query("SELECT Secret FROM Secrets WHERE ClientID=?", [clientID])).map(e => e.Secret)[0];
        } finally {
            conn.release();
        }
    }

    async guildLength(): Promise<number> {
        const conn = await this.mdb.getConnection();
        try {
            return (<{Count: number}[]>await conn.query("SELECT COUNT(*) as Count FROM Guilds")).map(e => e.Count)[0];
        } finally {
            conn.release();
        }
    }
    
    /**
     * @deprecated
     */
    async getGuilds(): Promise<string[]> {
        const conn = await this.mdb.getConnection();
        try {
            return (<{GuildID: bigint}[]>await conn.query("SELECT GuildID FROM Guilds")).map(e => e.GuildID.toString());
        } finally {
            conn.release();
        }
    }

    async getGuild(guildID: string, defaultPrefix: string): Promise<{ prefix: string; enabled: string[]; }> {
        const conn = await this.mdb.getConnection();
        try {
            const res: {prefix: string | null, enabled: string[]}[] = (<{Plugins: string[], Prefix: string}[]>await conn.query("SELECT Plugins, Prefix FROM Guilds WHERE GuildID=?", [guildID])).map(e => {return {prefix: e.Prefix, enabled: e.Plugins}});
            if (res.length) {
                if (res[0].prefix == null) res[0].prefix = defaultPrefix;
                return <{prefix: string, enabled: string[]}>res[0];
            }
            conn.query("INSERT INTO Guilds VALUES (?, ?, ?)", [guildID, "[\"Default\"]", defaultPrefix]);
            return {prefix: defaultPrefix, enabled: ["Default"]};
        } finally {
            conn.release();
        }
    }
    
    async checkGuildPlugin(guildID: string, plugin: string): Promise<boolean> {
        const conn = await this.mdb.getConnection();
        try {
            const res = (<{Plugins: string[]}[]>await conn.query("SELECT Plugins FROM Guilds WHERE GuildID=?", [guildID])).map(e => e.Plugins);
            if (!res.length) return plugin === "Default";
            return res[0].includes(plugin);
        } finally {
            conn.release();
        }
    }

    async getGuildPluginAliasesAndPerms<T extends PluginAliases, U extends PluginPerms>(guildID: string, plugin: string, defaultPluginAliases: T, defaultPluginPerms: U): Promise<{ aliases: T; perms: U; }> {
        const conn = await this.mdb.getConnection();
        try {
            const res = (<{Aliases: T | null, Perms: U | null}[]>await conn.query(`SELECT Aliases, Perms FROM Plugin${plugin} WHERE GuildID=?`, [guildID])).map(e => {return {aliases: e.Aliases, perms: e.Perms}});
            if (!res.length) {
                conn.query(`INSERT INTO Plugin${plugin} VALUES (?, ?, ?, ?)`, [guildID, defaultPluginAliases, defaultPluginPerms, null]);
                return {aliases: defaultPluginAliases, perms: defaultPluginPerms};
            }
            if (res[0].perms == null) {
                conn.query(`UPDATE Plugin${plugin} SET Perms=? WHERE GuildID=?`, [defaultPluginPerms, guildID]);
                res[0].perms = defaultPluginPerms;
            }
            if (res[0].aliases == null) {
                conn.query(`UPDATE Plugin${plugin} SET Aliases=? WHERE GuildID=?`, [defaultPluginAliases, guildID]);
                res[0].aliases = defaultPluginAliases;
            }
            return <{aliases: T, perms: U}>res[0];
        } finally {
            conn.release();
        }
    }

    async getGuildPluginData<T extends AbstractPluginData>(guildID: string, plugin: string, defaultData: T): Promise<T> {
        const conn = await this.mdb.getConnection();
        try {
            const res = (<{Data: T | null}[]>await conn.query(`SELECT Data FROM Plugin${plugin} WHERE GuildID=?`, [guildID])).map(e => e.Data);
            if (!res.length) {
                conn.query(`INSERT INTO Plugin${plugin} VALUES (?, ?, ?, ?)`, [guildID, null, null, defaultData]);
                return defaultData;
            }
            if (res[0] == null) {
                conn.query(`UPDATE Plugin${plugin} SET Data=? WHERE GuildID=?`, [defaultData, guildID]);
                return defaultData;
            }
            return res[0];
        } finally {
            conn.release();
        }
    }

    async setGuildPluginData<T extends AbstractPluginData>(guildID: string, plugin: string, data: T): Promise<void> {
        const conn = await this.mdb.getConnection();
        try {
            conn.query(`INSERT INTO Plugin${plugin} VALUES (?, null, null, ?) ON DUPLICATE KEY UPDATE Data=?`, [guildID, data, data]);
        } finally {
            conn.release();
        }
    }

    async setGuildPluginAliases<T extends PluginAliases>(guildID: string, plugin: string, aliases: T): Promise<void> {
        const conn = await this.mdb.getConnection();
        try {
            conn.query(`INSERT INTO Plugin${plugin} VALUES (?, ?, null, null) ON DUPLICATE KEY UPDATE Aliases=?`, [guildID, aliases, aliases]);
        } finally {
            conn.release();
        }
    }
    
    async setGuildPluginPerms<T extends PluginPerms>(guildID: string, plugin: string, perms: T): Promise<void> {
        const conn = await this.mdb.getConnection();
        try {
            conn.query(`INSERT INTO Plugin${plugin} VALUES (?, null, ?, null) ON DUPLICATE KEY UPDATE Perms=?`, [guildID, perms, perms]);
        } finally {
            conn.release();
        }
    }

    async setGuildPrefix(guildID: string, prefix: string): Promise<void> {
        const conn = await this.mdb.getConnection();
        try {
            conn.query("INSERT INTO Guilds VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE Prefix=?", [guildID, "[\"Default\"]", prefix, prefix]);
        } finally {
            conn.release();
        }
    }

    async setGuildEnabled(guildID: string, plugins: string[]): Promise<void> {
        const conn = await this.mdb.getConnection();
        try {
            conn.query("INSERT INTO Guilds VALUES (?, ?, null) ON DUPLICATE KEY UPDATE Plugins=?", [guildID, JSON.stringify(plugins), JSON.stringify(plugins)]);
        } finally {
            conn.release();
        }
    }

    async guildMemberAddEXP(guildID: string, plugin: string, member: string, increment: number): Promise<void> {
        const conn = await this.mdb.getConnection();
        try {
            conn.query("INSERT INTO MemberRank VALUES (?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE Score=Score+?", [`${member}:${guildID}`, member, guildID, increment, increment]);
        } finally {
            conn.release();
        }
    }

    async getRanks(guildID: string, plugin: string, start: number, count: number): Promise<{ member: string; score: number; }[]> {
        const conn = await this.mdb.getConnection();
        //SQL is 1 indexed
        count += 1;
        try {
            const res = (<{MemberID: bigint, Score: number}[]>await conn.query("SELECT MemberID, Score FROM (SELECT MemberID, Score, ROW_NUMBER() OVER (ORDER BY Score DESC) AS RowNo from MemberRank WHERE GuildID=?) t WHERE RowNo BETWEEN ? and ?", [guildID, start, start+count])).map(e => {return {member: e.MemberID.toString(), score: e.Score}});
            return res;
        } finally {
            conn.release();
        }
    }

    async getUserCount(guildID: string, plugin: string): Promise<number> {
        const conn = await this.mdb.getConnection();
        try {
            return (<{Count: number}[]>await conn.query("SELECT COUNT(*) as Count FROM MemberRank WHERE GuildID=?", [guildID])).map(e => e.Count)[0];
        } finally {
            conn.release();
        }
    }

    async deleteUser(guildID: string, plugin: string, member: string): Promise<void> {
        const conn = await this.mdb.getConnection();
        try {
            conn.query("DELETE FROM MemberRank WHERE MidGid=?", [`${member}:${guildID}`]);
        } finally {
            conn.release();
        }
    }

    async getGuildMemberEXP(guildID: string, plugin: string, member: string): Promise<{ rank: number | false; score: number; }> {
        const conn = await this.mdb.getConnection();
        try {
            const res = (<{Score: number, RowNo: bigint}[]>await conn.query("SELECT Score, RowNo FROM (SELECT MemberID, Score, ROW_NUMBER() OVER (ORDER BY Score DESC) AS RowNo from MemberRank WHERE GuildID=?) t WHERE MemberID=?", [guildID, member])).map(e => {return {rank: e.RowNo, score: e.Score}});
            if (!res.length) return {rank: false, score: 0}
            //SQL is 1 indexed
            res[0].rank -= 1n;
            return {rank: parseInt(res[0].rank.toString()), score: res[0].score};
        } finally {
            conn.release();
        }
    }

    async getGuildMemberLastMessageTime(guildID: string, plugin: string, member: string): Promise<number> {
        const conn = await this.mdb.getConnection();
        try {
            const res = (<{LastMsg: number}[]>await conn.query("SELECT LastMsg FROM MemberRank WHERE MidGid=?", [`${member}:${guildID}`])).map(e => e.LastMsg);
            if (!res.length) return 0;
            return res[0];
        } finally {
            conn.release();
        }
    }

    async setGuildMemberLastMessageTime(guildID: string, plugin: string, member: string, time: number): Promise<void> {
        const conn = await this.mdb.getConnection();
        try {
            conn.query("INSERT INTO MemberRank VALUES (?, ?, ?, 0, ?) ON DUPLICATE KEY UPDATE LastMsg=?", [`${member}:${guildID}`, member, guildID, time, time]);
        } finally {
            conn.release();
        }
    }
}