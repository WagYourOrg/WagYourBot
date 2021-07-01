

export interface ChannelFilterData {
    channels: {
        [key: string]: {
            filters: string[],
            attachments: boolean
        } | undefined
    },
    global: {
        filters: string[],
        attachments: boolean
    }
}