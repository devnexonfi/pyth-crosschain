import axios from 'axios'

interface ClientSubsMap {
  username: string
}

export default class Notifier {
  networkName: string
  chatIdsMap: {
    [id: number]: ClientSubsMap
  } = {}
  constructor({ networkName }: { networkName: string }) {
    this.networkName = networkName
    this.fetchUpdates(0)
  }

  fetchUpdates(duration: number) {
    setTimeout(async () => {
      await this.getUpdates()
      this.fetchUpdates(100000)
    }, duration)
  }

  async sendMsg(text: string) {
    const usernames = Object.keys(this.chatIdsMap).filter((cur: string) => {
      return true
    })
    const msgReqPromiseArr = usernames.map((cur) => {
      return axios
        .post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_ACCESS_TOKEN}/sendMessage`,
          {
            text: `${text}`,
            disable_web_page_preview: false,
            disable_notification: false,
            reply_to_message_id: null,
            chat_id: cur,
          }
        )
        .catch((_e) => {
          console.log('error', cur, _e)
        })
    })
    await Promise.all(msgReqPromiseArr)
  }

  async getUpdates() {
    const { data } = await axios.get(
      `https://api.telegram.org/bot${process.env.TELEGRAM_ACCESS_TOKEN}/getUpdates`
    )
    const result = data['result']
    const newChatIdsMap: {
      [id: number]: ClientSubsMap
    } = {}
    result.forEach(
      (cur: {
        message: {
          from: {
            id: number
            is_bot: boolean
            username: string
          }
          text: string
        }
      }) => {
        if (!cur.message.from.is_bot) {
          switch (cur.message.text) {
            case '/start':
              {
                newChatIdsMap[cur.message.from.id] = {
                  username: cur.message.from.username,
                }
              }
              break
            case '/stop':
              {
                delete newChatIdsMap[cur.message.from.id]
              }
              break
            default:
              break
          }
        }
      }
    )
    this.chatIdsMap = { ...newChatIdsMap }
    console.log('All connected users:', Object.keys(this.chatIdsMap))
  }
}
