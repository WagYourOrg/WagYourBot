import {Snowflake} from "discord.js";

export interface ReactRoleData {
    roles: {[emoji: string]: Snowflake | undefined},
    channel?: Snowflake,
    message: Snowflake[]
}
