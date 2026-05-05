import Foundation
extension ChannelsStore { func startAll() { for i in channels.indices { channels[i].enabled = true } }; func stopAll() { for i in channels.indices { channels[i].enabled = false } } }
