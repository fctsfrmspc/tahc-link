import { Client, MessageAttachment } from 'discord.js'
const bot = new Client()
import fs from 'fs'
import request from 'request'

import dotenv from 'dotenv'

import words from './words.json' assert { type: 'json' }
import wichtel from './wichtel.json' assert { type: 'json' };
import { whoPlayed } from './whoplayed.js'

dotenv.config()

let tahc
let logi = 0
const scaruffi = new RegExp('beatles', 'i')
const beatles = new RegExp('scaruffi', 'i')
const matosis = new RegExp('matosis', 'i')
const me = new RegExp('(^| )link([-,!.? ]|$)','i')

let image_search_locked = false

let saved_remind_mes = []

function truncateForCharacterLimit(str) {
	if (str.length > 2000)
		return str.substring(0,1997) + "..."
	return str
}

function log(sender, message) {
	let date = new Date()
	console.log(`[${logi}] ${date.toUTCString()}, from ${sender}: ${message}`)
	logi++
}

function rando(max,min) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
    let counter = array.length
    while (counter > 0) {
        let index = Math.floor(Math.random() * counter)
        counter--
        let temp = array[counter]
        array[counter] = array[index]
        array[index] = temp
    }
    return array
}

function search_pics(message,query) {
	let url = process.env.IMGBASE + "list_json.php"
	request.get(url, async (err,res,body) => {
		if (err) { 
			message.channel.send(`${process.env.IMGBASE} nicht erreichbar`)
			return log("search_pics", err)
		}
		if (res.statusCode == 200) {
			let data = JSON.parse(body)
			if (Array.isArray(data)) {
				let tmp = query.split(".")
				let query_noext = tmp[0]
				let regex_query = new RegExp(query_noext,"i")
				let exact = false
				let result_data = []
				for (let e of data) {
					if (query === e) {
						message.channel.send(process.env.IMGBASE + e)
						exact = true
						break
					}
					let noext = e.substring(0,e.lastIndexOf("."))
					if (regex_query.test(noext)) {
						result_data.push(e)
					}
				}
				if (!exact) {
					if (result_data.length > 1) {
						let joined = result_data.join(", ")
						if (joined.length >= 2000) {
							joined = truncateForCharacterLimit(joined)
						}
						message.channel.send(joined)
					} else if (result_data.length == 1) {
						message.channel.send(process.env.IMGBASE + result_data[0])
					} else {
						message.channel.send("nichts gefunden")
					}
				}
			} else {
				message.channel.send(`${process.env.IMGBASE} gab keine Liste zurück`)
				return log("search_pics", data)
			}
		}
	})
}

// Remind mes

function check_remind_mes() {
	let remind_me_queue = []
    for (let remind_me of saved_remind_mes) {
		let remaining_ms = remind_me["end_date"] - Date.now()
		if (remaining_ms < 60000) {
			remind_me_queue.push(remind_me)
		}
	}
	for (let remind_me of remind_me_queue) {
		remind(remind_me)
		let index = saved_remind_mes.indexOf(remind_me)
		if (index > -1) {
			saved_remind_mes.splice(index, 1)
			write_remind_mes_to_file()
		}
	}
	setTimeout(check_remind_mes, 60000)
}

function write_remind_mes_to_file() {
	try {
		fs.writeFileSync('remindMes.json', JSON.stringify(saved_remind_mes))
		log("write_remind_mes_to_file", `${saved_remind_mes.length} remindmes are currently active`)
	} catch (err) {
		log("write_remind_mes_to_file", err)
    }
}

function remind(remind_me) {
	bot.users.fetch(remind_me['user_id']).then(user => {
		bot.channels.fetch(remind_me['channel_id']).then(channel => {
			if (channel.type === "dm") {
				user.send(`reminder: ${remind_me['message']}`)
			} else {
				channel.send(`${user} reminder: ${remind_me['message']}`)
			}
		}).catch(err => {
			log("remindme", err)
		})
	}).catch(err => {
		log("remindme", err)
	})
}

function convert_remind_date_to_milliseconds(now, date_text) {
    if (/\d+[yMwdhm]/.test(date_text)) {
        const matched = date_text.match(/(\d+)([yMwdhm])/)
        const n = parseInt(matched[1])
        const type = matched[2]
        if (type == "m") { return now.valueOf() + (n * 60000) }
        else if (type == "h") { return now.valueOf() + (n * 3600000) }
        else if (type == "d") { return now.valueOf() + (n * 86400000) }
        else if (type == "w") { return now.valueOf() + (n * 604800000) }
        else if (type == "M") {
            let months = now.getMonth() + (n % 12)
            let years = Math.floor(n / 12)
            if (months > 11) {
                months = months % 12
                years += 1
            }
            const then = new Date(now.getFullYear() + years, months, now.getDate(), now.getHours(), now.getMinutes())
            return then.valueOf()
        }
        else if (type == "y") {
            const then = new Date(now.getFullYear() + n, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes())
            return then.valueOf()
        } else {
			return NaN
		}
    }
    else if (/\d?\d\.\d?\d\.(\d{4}|\d{2})-\d?\d:\d\d/.test(date_text)) {
        const matched = date_text.match(/(\d?\d)\.(\d?\d)\.(\d{4}|\d{2})-(\d?\d):(\d\d)/)
        let [day, month, year, hours, minutes] = matched.slice(1)
        day = Math.min(31, day)
        month = Math.max(0, month-1)
        hours = Math.min(23, hours)
        minutes = Math.min(59, minutes)
        year = (year.length == 2) ? parseInt("20"+year) : parseInt(year)
        let d = new Date(year, month, day, hours, minutes)
        return d.valueOf()
    }
    else if (/\d?\d\.\d?\d\.(\d{4}|\d{2})/.test(date_text)) {
        const matched = date_text.match(/(\d?\d)\.(\d?\d)\.(\d{4}|\d{2})/)
        let [day, month, year] = matched.slice(1)
        day = Math.min(31, day)
        month = Math.max(0, month-1)
        year = (year.length == 2) ? parseInt("20"+year) : parseInt(year)
        let d = new Date(year, month, day, now.getHours(), now.getMinutes())
        return d.valueOf()
    }
    else if (/\d?\d:\d\d/.test(date_text)) {
        const matched = date_text.match(/(\d?\d):(\d\d)/)
        let [hours, minutes] = matched.slice(1)
        hours = Math.min(23, hours)
        minutes = Math.min(59, minutes)
        let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
        return d.valueOf()
    } else {
		return NaN
	}
}

function convert_milliseconds_to_fulltext(start_ms, end_ms) {
	const ms = end_ms - start_ms
	const start_date = new Date(start_ms)
	const end_date = new Date(end_ms)
	if (ms < 86400000) {
		// less than a day, convert to text
		const d = new Date(ms)
		const values = [d.getUTCHours(), d.getUTCMinutes()]
		const names = [["stunde", "n"], ["minute", "n"]]
		let words = []
		for (i = 0; i < values.length; i++) {
			const value = values[i]
			if (value) {
				if (value > 1) {
					words.push(value + " " + names[i].join(""))
				} else {
					words.push(value + " " + names[i][0])
				}
			}
		}
		return `in ${words.join(" und ")}`
	} else {
		const y = (""+end_date.getFullYear()).substring(2,)
		const min = end_date.getMinutes()
		const m = (min < 10) ? "0"+min : min
		return `am ${end_date.getDate()}.${end_date.getMonth()+1}.${y} um ${end_date.getHours()}:${m} uhr`
	}
}

function sendHelpMessage(channel) {
	channel.send(
		"__Verfügbare Kommandos:__\n" +
		"`!roll` - Zufällige Zahl zwischen 1 und 6\n" +
		"`!roll int x, int y` - Zufäige Zahl zwischen x und y\n" +
		"`!roll str a, str b, str c...` - Zufälliger String\n" +
		"`!bild suchbegriff` - Sucht nach einem Bild in /chat/.\n" +
        "`!sag [...]` - Sag mir, was ich sagen soll.\n" +
		"`!wichtel` (nur DM) - Welche Figur wurde mir zugeordnet?\n" + 
		"`!whoplayed spiel`/`!wp spiel` - Wer hat [spiel] gespielt?\n" +
        "__RemindMe:__\n" +
        "`!remindme 2h [nachricht]` - Erinnert dich in 2 Stunden an [nachricht] (`y, M, w, d, h, m` möglich)\n" +
        "`!remindme 20:15 [nachricht]` - Erinnert dich um 20:15 Uhr an [nachricht]\n" +
        "`!remindme 31.10.23-13:37 [nachricht]` - Erinnert dich am 31.10.2023 um 13:37 Uhr an [nachricht]\n"
	)
}

bot.on("ready", () => {
	bot.users.fetch(process.env.EVIL).then(user => { user.send("hi") })
	bot.channels.fetch(process.env.TAHCID).then(channel => { tahc = channel })

    fs.readFile("remindMes.json", (err, data) => {
        if (err) { console.log(`fs.readFile: ${err} (Starting fresh)`) }
		else {
            saved_remind_mes = JSON.parse(data)
            log("ready", `${saved_remind_mes.length} remindmes are currently active`)
            check_remind_mes()
        }
    })
})

bot.login(process.env.TOKEN)

bot.on("message", async message => {
	if (message.author.bot) return;
	if (message.content.startsWith('!')) {
		if (message.content.startsWith('!sag')) {
			const saymessage = message.content.substring(4)
			tahc.send(saymessage)
		}
		else if (message.content.startsWith('!roll')) {
			const rollmessage = message.content.substring(5)
			const args = rollmessage.split(",")
			let num1, num2, rollit
			if (args.length == 2 && !isNaN(parseInt(args[0])) && !isNaN(parseInt(args[1]))) { 
				num1 = parseInt(args[0])
				num2 = parseInt(args[1])
				rollit = rando(num2,num1)
			} else if (args.length > 1) {
				num1 = rando(args.length-1,0)
				rollit = args[num1].trim()
			} else {
				rollit = rando(6,1)
			}
			return message.reply(rollit)
		}
		else if (message.content.startsWith('!bild')) {
			let splitmsg = message.content.split(" ")
			if (splitmsg.length > 1) {
				let query = splitmsg[1]
				if (query.length > 2) {
					if (!image_search_locked) {
						search_pics(message,query)
						image_search_locked = true
						setTimeout(() => { image_search_locked = false },3000)
					} else {
						message.channel.send("nicht so schnell")
					}
				} else {
					message.channel.send("suchbegriff zu kurz (min. 3 zeichen)")
				}
			}
		}
        else if (message.content.startsWith('!remindme')) {
			let splitmsg = message.content.split(" ")
			if (splitmsg.length < 2) {
                sendHelpMessage(message.channel)
                return
            }
            if (saved_remind_mes.length > 9) {
                message.reply("sorry, es können nur 10 reminder gleichzeitig aktiv sein")
                return
            }
            const remind_date = splitmsg[1]
            const now = new Date()
            const remind_milliseconds = convert_remind_date_to_milliseconds(now, remind_date)
            const remaining_ms = remind_milliseconds - now.valueOf()
            if (isNaN(remaining_ms) || remaining_ms < 60000) {
                message.reply("too soon")
                return
            }
            const remind_date_text = convert_milliseconds_to_fulltext(now.valueOf(), remind_milliseconds)
            const remind_message = (splitmsg.length < 2) ? "" : splitmsg.splice(2, splitmsg.length).join(" ")

            const new_remindme = { "user_id": message.author.id, "channel_id": message.channel.id, "end_date": remind_milliseconds, "message": remind_message }
            saved_remind_mes.push(new_remindme)
            // save
            write_remind_mes_to_file()
            
			message.reply(`ok, ich erinner dich ${remind_date_text}`)
			
			/*
			 * upper limit of timeout for setTimeout/setInterval is 2^32
			 * (roughly 24 days and 20 hours in ms)
			 * bot will save the reminder, but only start the timeout once
			 * its below the limit. problem: the bot checks this only once
			 * during start. so if the bot is not reset during that time,
			 * the reminder will never be sent...
			 * */
        }
		else if (message.content.startsWith('!wichtel')) {
			const ids = wichtel["ids"]
			const organisator_id = wichtel["organisator"]
			const organisator = ids[organisator_id]
			if (message.channel.type == "dm") {
				fs.readFile("/home/pi/wichtel_secret.json", (err, data) => {
					if (err) {
						if (err.code == "ENOENT")
							message.reply(`Es liegt aktuell keine Zuordnung von Usern und Figuren vor. (ENOENT)`)
						log("wichtel", err)
					}
					else {
						let figuren = JSON.parse(data)
						let userid = message.author.id
						if (!ids.hasOwnProperty(userid))
							return message.reply(`Unbekannter User. Nimmst du am Wichteln teil? Dann wende dich an ${organisator}.`)
						let this_user = ids[userid]
						if (!Object.keys(figuren).includes(this_user))
							return message.reply(`Du bist keiner Figur zugeordnet. Nimmst du am Wichteln teil? Dann wende dich an ${organisator}.`)
						let this_figur = figuren[this_user]
						message.reply(`du bist ${this_figur}.`)
					}
				})
			} else {
				if (message.author.id == organisator_id) {
					const usage_hint = "Befehl: `!wichtel player1, player2, ..., figur1, figur2, ...`"
					const wichtelMessage = message.content.replace(/^!wichtel/, "").trim();
					const args = wichtelMessage.split(",").map(str => str.trim())
					if (args.length < 4) {
						message.channel.send(`Es müssen mindestens zwei Leute teilnehmen! ${usage_hint}`)
						return
					}
					if (args.length % 2 != 0) {
						message.channel.send(`Die Anzahl der Spieler und Figuren muss gleich groß sein! ${usage_hint}`)
						return
					}
					const old_wichtel = wichtel["old"]
					const player_count = args.length/2
					const players = args.slice(0, player_count)
					const figures = shuffle(args.slice(player_count))
					let all_constells = []
					for (let player of players) {
						for (let other_player of players) {
							if (player != other_player) {
								if (old_wichtel.hasOwnProperty(player)) {
									if (!old_wichtel[player].includes(other_player)) {
										all_constells.push([player, other_player])
									}
								} else {
									message.channel.send(`User "${player}" nicht gefunden! Verfügbare User: ${Object.keys(old_wichtel).join(", ")}`)
									return
								}
							}
						}
					}
					log("wichtel", `Found ${all_constells.length} possible constellations`)
					const MAX_ITER = 999
					let i = 1
					let successful = false
					let final_constells
					while (!successful) {
						final_constells = []
						backup_players = [[...players], [...players]]
						all_constells = shuffle(all_constells)
						for (let constell of all_constells) {
							if (backup_players[0].includes(constell[0]) && backup_players[1].includes(constell[1])) {
								final_constells.push(constell)
								backup_players[0].splice(backup_players[0].indexOf(constell[0]), 1)
								backup_players[1].splice(backup_players[1].indexOf(constell[1]), 1)
							}
							if (final_constells.length == player_count) {
								successful = true
								log("wichtel", `Found ${player_count} unique constellations after ${i} attempts`)
								break
							}
						}
						if (i > MAX_ITER) {
							log("wichtel", `Could not find unique constellations after ${i} attempts`)
							return
						}
						i++
					}
					let stream_output = ""
					let json_output = {}
					for (let i = 0; i < player_count; i++) {
						stream_output += figures[i] + ": " + final_constells[i][1] + "\n"
						json_output[final_constells[i][0]] = figures[i]
					}
					const jsondata = JSON.stringify(json_output)
					fs.writeFile('/home/pi/wichtel_secret.json', jsondata, (err) => {
						if (err) {
							log("wichtel", err)
						} else {
							log("wichtel", `Successfully wrote to "wichtel_secret.json"`)
						}
					})
					message.author.send(stream_output)
					message.channel.send("done")
				} else {
					message.reply("um herauszufinden, welche Figur dir zugeordnet wurde, schreib mich privat mit dem Befehl `!wichtel` an.")
				}
			}
		} else if (message.content.startsWith('!whoplayed') || message.content.startsWith('!wp')) {
			let splitmsg = message.content.split(" ")
			if (splitmsg.length > 1) {
				splitmsg.shift()
				let query = splitmsg.join(" ").trim()
				let res = await whoPlayed(query)
				if (res)
					message.channel.send(truncateForCharacterLimit(res))
			}
		}
		else {
			sendHelpMessage(message.channel)
		}
	} else {
		if (scaruffi.test(message.content)) {
			let scaruffiwords = words.beatles
			for (let paragraph of scaruffiwords) {
				await message.channel.send(paragraph)
			}
		}
		if (me.test(message.content)) {
			let linkquotes = words.link
			let aany = rando(linkquotes.length,0)
			setTimeout(() => { message.channel.send(linkquotes[aany]) },2000)
		}
		if (beatles.test(message.content)) {
			const piedo = new MessageAttachment("https://3v1l.bplaced.net/stuff/scariffo.png")
			await message.channel.send(words.scaruffi) 
			await message.channel.send(piedo)
		}
		if (matosis.test(message.content)) {
			const matosispic = new MessageAttachment("https://3v1l.bplaced.net/stuff/matosis.jpg")
			await message.channel.send(matosispic)
			await message.channel.send(words.matosis) 
		}
		if (message.content === "schön für dich") {
			message.channel.send(words.zocker)
		}
	}
});
