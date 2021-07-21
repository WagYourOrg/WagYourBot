import {Snowflake} from "discord.js";


export interface MessageActionsData {
    actions: MessageActionData[];
}

export enum MessageActionTypes {
    AddDeleteReaction=0x1, Give_Role=0x2, Take_Role=0x4, Respond=0x8
}

export interface MessageActionData {
    regex: string
    types: number & MessageActionTypes
    data: ActionData
}

export type ActionData = permutations<GiveRoleData, TakeRoleData, ResponseData>

type permutations<T, U, V> = T | U | V | T & U | T & V | U & V | T & U & V | {};

export interface GiveRoleData {
    give: Snowflake
}

export interface TakeRoleData {
    take: Snowflake
}

export interface ResponseField {
    title: string
    body: string
    inline: boolean
}

export interface ResponseData {
    title?: string
    description?: string
    field: ResponseField[]
    image?: string
    deleteReaction: boolean
}