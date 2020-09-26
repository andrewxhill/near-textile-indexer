global.WebSocket = require('isomorphic-ws')

const dotenv = require('dotenv')
const fs = require('fs')
const path = require('path')
const Textile = require('./textile')

const sync = require('./sync')

dotenv.config()

const keyInfo = {
	key: 'bxlflunozpu2t56cuny4tptz3xm',
}

const getSetup = async (setupPath) => {
	try {
		const setupJSON = fs.readFileSync(setupPath)
		const setupData = JSON.parse(setupJSON)
		if (
			!(
				setupData.hasOwnProperty('threadID') &&
				setupData.hasOwnProperty('eventHeight')
			)
		) {
			throw new Error('Invalid setup.json')
		}
		return setupData
	} catch (err) {
		if (err.code == 'ENOENT') {
			return null
		} else {
			throw err
		}
	}
}

const main = async (config) => {
	if (!config.contractName) {
		console.log('[config] contractName is required')
		process.exit(1)
	}
	const setupPath = path.join(process.cwd(), 'setup.json')
	const ctx = {}
	try {
		let setup = await getSetup(setupPath)

		const textile = new Textile()
		await textile.init(keyInfo)

		if (!setup) {
			// generate setup.json
			const dbName = `${config.contractName}-${new Date().getTime()}`
			const threadID = await textile.client.newDB(undefined, dbName)
			const setupData = {
				threadID: threadID.toString(),
				eventHeight: 0,
			}
			fs.writeFileSync(setupPath, JSON.stringify(setupData))
			setup = setupData
		}
		ctx.setup = setup
		ctx.threadID = await textile.parseThreadID(setup.threadID)
		ctx.setupPath = setupPath

		for (const collection of config.collections) {
			try {
				await textile.client.getCollectionInfo(ctx.threadID, collection.name)
				await textile.client.updateCollection(ctx.threadID, collection)
			} catch (err) {
				if (err.message === 'collection not found') {
					console.log(collection)
					await textile.client.newCollection(ctx.threadID, collection)
				}
				else {
					console.log(err)
				}
			}
		}

		sync(ctx, textile.client, config)
	} catch (err) {
		console.log(err)
		process.exit(1)
	}
}

module.exports = main
