import { where } from './where'
import {
  channelOf as roomOf,
  fromKey,
  reloadChannels as reloadRooms,
  teamKey,
  useChannels as useRooms,
  useMessages,
  type Channel,
  type Channel as Room,
  type Message,
} from './channels'

export const roomHref = (key: string): string => `${where().home}?${new URLSearchParams({ room: key })}`

export {
  roomOf,
  fromKey,
  reloadRooms,
  teamKey,
  useRooms,
  useMessages,
  type Channel,
  type Room,
  type Message,
}
