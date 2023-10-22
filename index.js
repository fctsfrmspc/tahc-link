const { Client, MessageAttachment } = require('discord.js')
const bot = new Client()
const fs = require('fs')
const request = require('request')
const cheerio = require('cheerio')
require('dotenv').config()
const words = require('./words.json')
const wichtel = require('./wichtel.json')

let tahc
let logi = 0
const scaruffi = new RegExp('beatles', 'i')
const beatles = new RegExp('scaruffi', 'i')
const me = new RegExp('(^| )link([-,!.? ]|$)','i')

let last_soso = -1

let image_search_locked = false

let saved_remind_mes = []
let remind_me_timeouts = []

// for polls (TODO: turn this into a class...)
let currentPoll = {}
let pollVoters = {}
let pollRunning = false
let pollRunner = []
let pollTotalVotes = 0
let pollExpiryTimeout = null
let pollMinAnswers = 1
let pollMaxAnswers = 1
let pollChannel = null

/* let sosotimeout = setInterval(() => {
	getSoSo()
}, process.env.SOSOMINUTES * 60000); */

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

function htmlDecode(value) {
	return $("<div/>").html(value).text();
}

function findKeyinJSON(obj,key) {
	let result = null
	if (obj != null) {
		if (Array.isArray(obj)) {
			for (let i=0; i < obj.length; i++) {
				if (typeof obj[i] == "object") {
					result = findKeyinJSON(obj[i],key)
				}
				if (result) {
					break
				}
			}
		} else if (obj.hasOwnProperty(key)) {
			return obj[key]
		} else {
			for (let i=0; i < Object.keys(obj).length; i++) {
				if (typeof obj[Object.keys(obj)[i]] == "object") {
					result = findKeyinJSON(obj[Object.keys(obj)[i]],key)
				}
				if (result) {
					break
				}
			}
		}
	}
	return result
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
							joined = joined.substring(0,1997) + "..."
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
		if (remaining_ms < 5000) {
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
	setTimeout(check_remind_mes, 5000)
}

function write_remind_mes_to_file() {
	try {
		fs.writeFileSync('/tmp/remindMes.json', JSON.stringify(saved_remind_mes))
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

// Soso

function getSoSo() {
	request.get("https://oc.mymovies.dk/em2thejay/collectionNumber:desc", async (err,res,body) => {
		if (err) { return log("getSoso", err) }
		if (res.statusCode == 200) {
			let rawHtml = body
			$ = cheerio.load(rawHtml)
			let titleList = $("li.titleCaption")
			if (titleList.length > 0) {
				let valuesToPost = []
				let isFirstElement = true
				let tempSoso
				titleList.each((index,element) => {
					if (index > 4) return false
					let number = parseInt($(element).find("p").html().trim().substring(1,4))
					let title = htmlDecode($(element).find("h3").html())
					if (number > last_soso && last_soso != -1) {
						valuesToPost[index] = {"number":number,"title":title}
					}
					if (isFirstElement) tempSoso = number
					isFirstElement = false
				})
				last_soso = tempSoso
				if (valuesToPost.length > 0) {
					valuesToPost.reverse()
					for (let obj of valuesToPost) {
						let strToPost = `Soso hat den Titel **${obj["title"]}** seiner Sammlung hinzugefügt. Dies ist der **${obj["number"]}**. Eintrag in seiner Liste. \:thumbsup:`
						tahc.send(strToPost)
						log("getSoso", obj["number"])
					}
				} else {
					log("getSoso", `No new titles found [Last no.: ${last_soso}]`)
				}
				let newObj = { soso: last_soso }
				let data = JSON.stringify(newObj)
				fs.writeFile("/tmp/lastValues.json", data, { flag: "w" }, (err) => {
					if (err) log("getSoso", err)
				})
			} else {
				log("getSoso", "No titles found")
				return false
			}
		} else {
			log("getSoso", `${res.statusCode} : ${res.statusMessage}`)
			return false
		}
	})
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
        "__RemindMe:__\n" +
        "`!remindme 2h [nachricht]` - Erinnert dich in 2 Stunden an [nachricht] (`y, M, w, d, h, m` möglich)\n" +
        "`!remindme 20:15 [nachricht]` - Erinnert dich um 20:15 Uhr an [nachricht]\n" +
        "`!remindme 31.10.23-13:37 [nachricht]` - Erinnert dich am 31.10.2023 um 13:37 Uhr an [nachricht]\n" +
		"__Umfragen:__\n" +
		"`!poll` - Zeige den Stand der aktuellen Umfrage an.\n" +
		"`!poll new` - Erstelle eine neue Umfrage (`!poll new Frage; Antwort 1; Antwort 2; ...`)\n" +
		"`!poll new 2:5 ...` - Multiple-Choice-Umfrage mit mindestens 2 und maximal 5 Stimmen pro Teilnehmer\n" +
		"`!poll end` - Beende die aktuelle Umfrage und zeige die Ergebnisse an.\n" +
		"`!poll A` - Stimme für Antwort A ab.\n" +
		"`!poll unvote` - Ziehe alle von dir abgegebenen Stimmen zurück.\n" +
		"`!poll extend` - Verlängere die Umfrage um 24 Stunden, ab jetzt.\n" +
		"Umfragen laufen nach 24 Stunden automatisch ab. Um anonym abzustimmen, verwende die Befehle im privaten Chat mit mir."
	)
}

// for polls

function sortPollAfterVotes() {
	let pollAnswerCounts = []
	for (let answer of Object.keys(currentPoll.a)) {
		pollAnswerCounts.push([answer, currentPoll.a[answer].votes])
	}
	pollAnswerCounts.sort(function(a, b) {
		return b[1] - a[1]
	})
	return pollAnswerCounts
}

function displayPoll(created) {
	if (!pollChannel)
		return
	
	const pollAnswerCounts = sortPollAfterVotes()
	let outputString = ""
	if (created) {
		outputString = `${pollRunner[1]} möchte wissen:\n`
	}
	outputString += `**${currentPoll.q}**\n`
	for (let answer of pollAnswerCounts) {
		const answerLetter = answer[0]
		const theseVotes = answer[1]
		const theseVoters = currentPoll.a[answerLetter].votedUsers.map(user => pollVoters[user].name).join(", ") // get nicknames
		const s = (theseVotes === 1) ? "vote" : "votes"
		outputString += `**${answerLetter}** - ${currentPoll.a[answerLetter].text} (${theseVotes} ${s})\n`
		if (theseVotes > 0) {
			outputString += `*voted by: ${theseVoters}*\n`
		}
	}
	outputString += `insgesamt: ${pollTotalVotes}\n`
	// multiple-choice?
	if (pollMaxAnswers > 1) {
		outputString += "Dies ist eine **Multiple-Choice**-Umfrage. "
		if (pollMinAnswers === pollMaxAnswers) {
			outputString += `Es müssen genau **${pollMinAnswers} Stimmen** abgegeben werden.\n`
		} else {
			outputString += `Es müssen mindestens **${pollMinAnswers}**, aber maximal **${pollMaxAnswers} Stimmen** abgegeben werden.\n`
		}
		outputString += "Um abzustimmen, sende `!poll` und die Antwortbuchstaben (z.B. `!poll A, B`)"
	} else {
		outputString += "Um abzustimmen, sende `!poll` und den Antwortbuchstaben (z.B. `!poll A`)"
	}
	pollChannel.send(outputString)
}

function endPoll(creatorEnded) {
	// reset everything and show result
	let pollAnswerCounts = sortPollAfterVotes()
	let outputString = ""
	if (creatorEnded) {
		outputString += `Der Fragesteller hat die aktuelle Umfrage beendet.\n`
	} else {
		outputString += `Die aktuelle Umfrage wurde nach Ablauf der Zeit automatisch beendet.\n`
	}
	outputString += `Q: **${currentPoll.q}**\n`
	// multiple answers won?
	let prevVotes = pollAnswerCounts[0][1]
	if (prevVotes === 0) {
		outputString += "Es wurden keine Stimmen abgegeben."
	} else {
		let pollAnswerCountsWon = [pollAnswerCounts.shift()]
		for (let answer of pollAnswerCounts) {
			if (answer[1] === prevVotes) {
				pollAnswerCountsWon.push(answer)
			} else {
				break
			}
			prevVotes = answer[1]
		}
		if (pollAnswerCountsWon.length === 1) {
			const winner = pollAnswerCountsWon[0]
			const percentVotes = (winner[1] > 0) ? winner[1] / pollTotalVotes * 100 : 0
			const theseVoters = currentPoll.a[winner[0]].votedUsers.map(user => pollVoters[user].name).join(", ") // get nicknames
			const n = (winner[1] === 1) ? "Stimme" : "Stimmen"
			outputString += `Gewonnen hat:\n`
			outputString += `**${currentPoll.a[winner[0]].text}**\n`
			outputString += `mit **${winner[1]}** ${n} (${percentVotes.toFixed(0)}%), gewählt von: ${theseVoters}`
		} else if (pollAnswerCountsWon.length > 1) {
			const percentVotes = (prevVotes > 0) ? prevVotes / pollTotalVotes * 100 : 0
			const n = (prevVotes === 1) ? "Stimme" : "Stimmen"
			outputString += `Gewonnen haben:\n`
			for (let winner of pollAnswerCountsWon) {
				outputString += `**${currentPoll.a[winner[0]].text}**\n`
			}
			outputString += `mit jeweils **${pollAnswerCountsWon[0][1]}** ${n}! (${percentVotes.toFixed(0)}%)`
		} else {
			outputString += `beim zusammenzählen der ergebnisse ist ein fehler aufgetreten...`
			log("endPoll", `pollAnswerCounts: ${pollAnswerCounts}`)
			log("endPoll", `pollAnswerCountsWon: ${pollAnswerCountsWon}`)
		}	
	}	
	currentPoll = {}
	pollVoters = {}
	pollRunning = false
	pollRunner = []
	pollTotalVotes = 0
	pollMinAnswers = 1
	pollMaxAnswers = 1
	clearTimeout(pollExpiryTimeout)
	pollChannel.send(outputString)
	pollChannel = null
}

bot.on("ready", () => {
	bot.users.fetch(process.env.EVIL).then(user => { user.send("hi") })
	bot.channels.fetch(process.env.TAHCID).then(channel => { tahc = channel })
	fs.readFile("/tmp/lastValues.json", (err, data) => {
		if (err) { console.log(`fs.readFile: ${err} (Starting fresh)`) }
		else {
			const json_data = JSON.parse(data)
			last_soso = json_data.soso
		}
	})
    fs.readFile("/tmp/remindMes.json", (err, data) => {
        if (err) { console.log(`fs.readFile: ${err} (Starting fresh)`) }
		else {
            saved_remind_mes = JSON.parse(data)
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
				fs.readFile("wichtel_secret.json", (err, data) => {
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
					const wichtelMessage = message.content.substring(10)
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
					fs.writeFile('wichtel_secret.json', jsondata, (err) => {
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
		} else if (message.content.startsWith('!poll')) {
			const authorId = message.author.id
			let nickname = "Anonymous"
			if (message.channel.type === "text") {
				nickname = message.channel.members.get(authorId).displayName
			}
			if (message.content.startsWith('!poll new')) {
				if (message.channel.type === "dm") {
					message.reply("umfragen bitte nicht im privatchat erstellen...")
					return
				}
				if (pollRunning) {
					message.reply("es läuft bereits eine umfrage! (beenden mit `!poll end` oder anzeigen mit `!poll`)")
					return
				}
				const alphabet = [...Array(26)].map(a=>a = String.fromCharCode(i++),i=65)
				let qAndA = message.content.substring(9).split(";").map(str => str.trim())
				if (qAndA[qAndA.length - 1].length === 0) qAndA.pop() // delete last answer if last letter was ";"
				if (qAndA.length > alphabet.length) {
					return message.reply("zu viele antwortmöglichkeiten... maximal 26 sind erlaubt")
				}
				if (qAndA.length < 3) {
					return message.reply("es muss mindestens 2 antwortmöglichkeiten geben... frage und antworten werden mit einem semikolon getrennt.")
				}
				let question = qAndA.shift()
				// check whether new poll is multiple-choice (!poll new <min>:<max> question; ...)
				if (question.indexOf(":") != -1 && question.indexOf(" ") != -1) {
					const q_split = question.split(" ")
					const numbers = q_split[0]
					if (numbers.indexOf(":") != -1) {
						const minMax = numbers.split(":").map(str => Number.parseInt(str))
						// if x:y aren't numbers, interpret them as part of the question (no multi)
						if (!isNaN(minMax[0]) && !isNaN(minMax[1])) {
							if (minMax[1] <= qAndA.length) {
								if (minMax[0] <= minMax[1]) {
									if (minMax[0] > 0) {
										pollMinAnswers = minMax[0]
										pollMaxAnswers = minMax[1]
										question = q_split.slice(1, q_split.length).join(" ")
									} else {
										return message.reply(`die mindestanzahl an antworten (${minMax[0]}) muss größer als 0 sein...`)
									}
								} else {
									return message.reply(`die mindestanzahl an antworten (${minMax[0]}) ist größer als die maximalanzahl... (${minMax[1]})`)
								}
							} else {
								return message.reply(`die maximale anzahl an wählbaren antworten (${minMax[1]}) überschreitet die anzahl der antworten... (${qAndA.length})`)
							}
						}
					}
				}
				currentPoll.q = question
				currentPoll.a = {}
				for (let qA of qAndA) {
					const thisLetter = alphabet.shift()
					currentPoll.a[thisLetter] = {
						"text": qA,
						"votes": 0,
						"votedUsers": []
					}
				}
				// default: 24 hours until expiry
				pollExpiryTimeout = setTimeout(() => {
					endPoll(false)
				}, 24 * 3600000)
				pollRunning = true
				pollRunner = [authorId, nickname]
				pollTotalVotes = 0
				pollVoters = {}
				pollChannel = message.channel
				displayPoll(true)
			} else {
				if (pollRunning) {
					if (message.content.startsWith('!poll extend')) {
						// reset the timer
						if (authorId === pollRunner[0]) {
							clearTimeout(pollExpiryTimeout)
							pollExpiryTimeout = setTimeout(() => {
								endPoll(false)
							}, 24 * 3600000)
							message.reply("die umfrage wurde um 24 stunden verlängert.")
						} else {
							message.reply(`nur ${pollRunner[1]} kann diese Umfrage verlängern`)
						}
					}
					else if (message.content.startsWith('!poll end')) {
						// show final results
						if (authorId === pollRunner[0]) {
							endPoll(true)
						} else {
							message.reply(`nur ${pollRunner[1]} kann diese Umfrage beenden`)
						}
					}
					else if (message.content === "!poll unvote") {
						if (pollVoters.hasOwnProperty(authorId)) {
							for (let votedAnswer of pollVoters[authorId].votedFor) {
								const votedUsersIndex = currentPoll.a[votedAnswer].votedUsers.indexOf(authorId)
								currentPoll.a[votedAnswer].votedUsers.splice(votedUsersIndex, 1)
								currentPoll.a[votedAnswer].votes--
								pollTotalVotes--
							}
							delete pollVoters[authorId]
							displayPoll(false)
						} else {
							message.reply("du hast noch nicht abgestimmt!")
						}
					}
					else if (message.content === "!poll") {
						displayPoll(false)
					}
					else {
						// vote
						// check whether user has reached max allowed votes
						let alreadyVoted = []
						if (pollVoters.hasOwnProperty(authorId)) {
							alreadyVoted = pollVoters[authorId].votedFor
							if (alreadyVoted.length === pollMaxAnswers) {
								if (pollMaxAnswers === 1) {
									return message.reply("du hast bereits abgestimmt!")
								} else {
									return message.reply("du hast die maximalzahl an votes erreicht!")
								}
							}
						}
						// extract votes
						const voteString = message.content.substring(6)
						let votedLetters = []
						if (voteString.indexOf(",") != -1) {
							votedLetters = voteString.split(",").map(str => str.trim().toUpperCase())
						} else if (voteString.indexOf(";") != -1) {
							votedLetters = voteString.split(";").map(str => str.trim().toUpperCase())
						} else {
							votedLetters = [voteString.trim().toUpperCase()]
						}
						// match number of votes and allowed no. of votes
						if ((votedLetters.length + alreadyVoted.length) > pollMaxAnswers) {
							return message.reply(`du darfst insgesamt maximal ${pollMaxAnswers} stimmen abgeben!`)
						} else if ((votedLetters.length + alreadyVoted.length) < pollMinAnswers) {
							return message.reply(`du musst mindestens ${pollMinAnswers} stimmen abgeben!`)
						} else {
							for (let vote of votedLetters) {
								// check if voted letters are valid
								if (!currentPoll.a.hasOwnProperty(vote)) {
									return message.reply(`antwort "${vote}" nicht gefunden. mögliche antworten: ${Object.keys(currentPoll.a).join(", ")}`)
								}
								// check of user has already voted for this answer
								if (currentPoll.a[vote].votedUsers.includes(authorId)) {
									return message.reply(`du hast bereits für antwort ${vote} abgestimmt!`)
								}
							}
							// add vote(s)
							for (let vote of votedLetters) {
								currentPoll.a[vote].votes++
								currentPoll.a[vote].votedUsers.push(authorId)
							}
							pollTotalVotes += votedLetters.length
							// update user
							if (alreadyVoted.length > 0) {
								pollVoters[authorId].votedFor = alreadyVoted.concat(votedLetters)
								pollVoters[authorId].name = nickname // name may have changed, overwrite
							} else {
								pollVoters[authorId] = { "votedFor": votedLetters, "name": nickname }
							}
							displayPoll(false)
						}
					}
				} else {
					message.reply("es läuft momentan keine umfrage. erstelle eine neue mit `!poll new Frage; Antwort A; Antwort B; Antwort C; ...` (achtung: semikolon!)")
				}
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
			await setTimeout(() => { message.channel.send(linkquotes[aany]) },2000)
		}
		if (beatles.test(message.content)) {
			const piedo = new MessageAttachment("https://i.imgur.com/RLbYJlv.png")
			await message.channel.send(words.scaruffi) 
			await message.channel.send(piedo)
		}
		if (message.content === "schön für dich") {
			message.channel.send(words.zocker)
		}
	}
});
