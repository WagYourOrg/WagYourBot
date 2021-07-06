import {Snowflake} from "discord.js";


export interface MemberRankData {
    dynamic: {
        [key: number]: Snowflake | undefined;
    },
    static: {
        [key: number]: Snowflake | undefined;
    }
}