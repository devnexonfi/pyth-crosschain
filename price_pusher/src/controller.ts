import { UnixTimestamp } from '@pythnetwork/price-service-client'
import { DurationInSeconds, sleep } from './utils'
import { IPricePusher, IPriceListener } from './interface'
import { PriceConfig, shouldUpdate } from './price-config'
import Web3 from 'web3'
import Notifier from './notifier/Notifier'

export class Controller {
  private pushingFrequency: DurationInSeconds
  private web3: Web3
  private notifier: Notifier
  constructor(
    private priceConfigs: PriceConfig[],
    private sourcePriceListener: IPriceListener,
    private targetPriceListener: IPriceListener,
    private targetChainPricePusher: IPricePusher,
    config: {
      pushingFrequency: DurationInSeconds
    }
  ) {
    this.pushingFrequency = config.pushingFrequency
    this.web3 = new Web3('https://zksync2-testnet.zksync.dev')
    this.notifier = new Notifier({
      networkName: 'zksync2.0_testnet',
    })
  }

  async start() {
    // start the listeners
    await this.sourcePriceListener.start()
    await this.targetPriceListener.start()

    console.log(process.env)

    // wait for the listeners to get updated. There could be a restart
    // before this run and we need to respect the cooldown duration as
    // their might be a message sent before.
    await sleep(this.pushingFrequency * 1000)

    for (;;) {
      const pricesToPush: PriceConfig[] = []
      const pubTimesToPush: UnixTimestamp[] = []

      console.log(process.env, "Hi")
      for (const priceConfig of this.priceConfigs) {
        const priceId = priceConfig.id

        if (process.env.PRICE_PUSHER_ADDRESS) {
          const balance = await this.web3.eth.getBalance(
            process.env.PRICE_PUSHER_ADDRESS
          )
          console.log(balance.toString())
          this.notifier.sendMsg(`New wallet balance: ${balance.toString()}`)
        }

        const targetLatestPrice =
          this.targetPriceListener.getLatestPriceInfo(priceId)
        const sourceLatestPrice =
          this.sourcePriceListener.getLatestPriceInfo(priceId)

        if (shouldUpdate(priceConfig, sourceLatestPrice, targetLatestPrice)) {
          pricesToPush.push(priceConfig)
          pubTimesToPush.push((targetLatestPrice?.publishTime || 0) + 1)
        }
      }
      if (pricesToPush.length !== 0) {
        console.log(
          'Some of the above values passed the threshold. Will push the price.'
        )

        // note that the priceIds are without leading "0x"
        const priceIds = pricesToPush.map((priceConfig) => priceConfig.id)
        this.targetChainPricePusher.updatePriceFeed(priceIds, pubTimesToPush)
      } else {
        console.log(
          'None of the above values passed the threshold. No push needed.'
        )
      }

      await sleep(this.pushingFrequency * 1000)
    }
  }
}
