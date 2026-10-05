const assert = require('assert').strict
const fs = require('fs')
const path = require('path')
const vm = require('vm')

// Run the real bot code with imports replaced by offline dependencies.
const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
    .replace(/^import .*\r?\n/gm, '')
const MAX_TIMEOUT = 2147483647

function harness(saved = [], readError = null) {
    let now = 1700000000000
    let nextId = 1
    const timers = new Map()
    const handlers = {}
    const sent = []
    const writes = []
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [now])) }
        static now() { return now }
    }
    class Client {
        constructor() {
            this.users = { fetch: () => Promise.resolve({ send() {} }) }
            this.channels = { fetch: () => Promise.resolve({ send() {} }) }
        }
        on(event, callback) { handlers[event] = callback }
        login() {}
    }
    const context = vm.createContext({
        Client, User: class User {}, Date: Clock, console: { log() {} },
        dotenv: { config() {} }, process: { env: { REMINDMES_PATH: 'reminders.json' } },
        fs: {
            readFile: (filename, callback) => callback(readError, JSON.stringify(saved)),
            writeFileSync: (filename, data) => writes.push(JSON.parse(data))
        },
        setTimeout: (callback, delay) => {
            const id = nextId++
            timers.set(id, { callback, delay, deadline: now + delay })
            return id
        },
        clearTimeout: id => timers.delete(id)
    })
    vm.runInContext(source, context, { filename: 'index.js' })
    context.remind = reminder => sent.push(reminder.message)
    handlers.ready()
    return {
        sent, writes, timers,
        now: () => now,
        timer: () => {
            assert.equal(timers.size, 1)
            return timers.values().next().value
        },
        fire: time => {
            assert.equal(timers.size, 1)
            const [id, timer] = timers.entries().next().value
            timers.delete(id)
            now = time === undefined ? timer.deadline : time
            timer.callback()
        },
        add: date => handlers.message({
            author: { id: 'user', bot: false },
            channel: { id: 'channel' },
            content: `!remindme ${date} new reminder`, reply() {}
        })
    }
}

const BASE = 1700000000000
const reminder = (offset, message) => ({ end_date: BASE + offset, message })
const cases = [
    ['no timer when empty', () => {
        const h = harness()
        assert.equal(h.timers.size, 0)
        assert.equal(h.writes.length, 0)
    }],
    ['select earliest reminder from unsorted input', () => {
        const h = harness([reminder(300000, 'later'), reminder(90000, 'first')])
        assert.equal(h.timer().delay, 90000)
        h.fire()
        assert.deepEqual(h.sent, ['first'])
        assert.equal(h.timer().delay, 210000)
    }],
    ['recheck deadline if callback runs early', () => {
        const h = harness([reminder(90000, 'first')])
        h.fire(BASE + 89999)
        assert.deepEqual(h.sent, [])
        assert.equal(h.writes.length, 0)
        assert.equal(h.timer().delay, 1)
        h.fire()
        assert.deepEqual(h.sent, ['first'])
        assert.equal(h.timers.size, 0)
    }],
    ['late callback sends all due reminders and writes once', () => {
        const h = harness([
            reminder(90000, 'first'), reminder(100000, 'second'), reminder(200000, 'later')
        ])
        h.fire(BASE + 150000)
        assert.deepEqual(h.sent, ['first', 'second'])
        assert.equal(h.writes.length, 1)
        assert.deepEqual(h.writes[0], [reminder(200000, 'later')])
        assert.equal(h.timer().delay, 50000)
    }],
    ['equal deadlines send once each and leave no timer', () => {
        const h = harness([reminder(90000, 'one'), reminder(90000, 'two')])
        h.fire()
        assert.deepEqual(h.sent, ['one', 'two'])
        assert.deepEqual(h.writes, [[]])
        assert.equal(h.timers.size, 0)
    }],
    ['new earlier command replaces active timer', async () => {
        const h = harness([reminder(3600000, 'later')])
        const oldId = h.timers.keys().next().value
        await h.add('2m')
        assert.equal(h.timers.has(oldId), false)
        assert.equal(h.timer().delay, 120000)
        h.fire()
        assert.deepEqual(h.sent, ['new reminder'])
        assert.equal(h.timer().delay, 3480000)
    }],
    ['long reminder waits in bounded chunks without early delivery', () => {
        const h = harness([reminder(MAX_TIMEOUT * 2 + 1000, 'far away')])
        assert.equal(h.timer().delay, MAX_TIMEOUT)
        h.fire()
        assert.deepEqual(h.sent, [])
        assert.equal(h.writes.length, 0)
        assert.equal(h.timer().delay, MAX_TIMEOUT)
        h.fire()
        assert.deepEqual(h.sent, [])
        assert.equal(h.timer().delay, 1000)
        h.fire()
        assert.deepEqual(h.sent, ['far away'])
        assert.deepEqual(h.writes, [[]])
        assert.equal(h.timers.size, 0)
    }],
    ['startup schedules overdue reminders immediately', () => {
        const h = harness([reminder(60000, 'future'), reminder(-60000, 'overdue')])
        assert.equal(h.timer().delay, 0)
        h.fire()
        assert.deepEqual(h.sent, ['overdue'])
        assert.deepEqual(h.writes, [[reminder(60000, 'future')]])
        assert.equal(h.timer().delay, 60000)
    }],
    ['allow up to 1000 active reminders', async () => {
        const h = harness(Array.from({ length: 999 }, (_, i) => reminder(3600000, `saved ${i}`)))
        await h.add('2m')
        assert.equal(h.writes.length, 1)
        assert.equal(h.writes[0].length, 1000)
        assert.equal(h.timer().delay, 120000)
        await h.add('3m')
        assert.equal(h.writes.length, 1)
        assert.equal(h.timer().delay, 120000)
    }],
    ['missing file still permits new reminders to run', async () => {
        const h = harness([], Object.assign(new Error('not found'), { code: 'ENOENT' }))
        assert.equal(h.timers.size, 0)
        await h.add('2m')
        assert.equal(h.timer().delay, 120000)
        h.fire()
        assert.deepEqual(h.sent, ['new reminder'])
        assert.equal(h.timers.size, 0)
    }]
]

;(async () => {
    for (const [name, run] of cases) {
        await run()
        console.log(`ok - ${name}`)
    }
    console.log(`${cases.length} scheduler tests passed`)
})().catch(error => {
    console.error(error)
    process.exitCode = 1
})
