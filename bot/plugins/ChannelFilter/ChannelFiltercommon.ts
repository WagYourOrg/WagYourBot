

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

export interface CompiledChannelFilterData {
    channels: {
        [key: string]: {
            filters: RegExp[],
            attachments: boolean;
        }
    }
    global: {
        filters: RegExp[],
        attachments: boolean;
    }
}