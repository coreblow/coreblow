/** CoreBlow — Plugin Adapter Types */ export interface ChannelAdapter { connect(): Promise<void>; disconnect(): Promise<void>; send(target: string, message: string): Promise<boolean>; }
