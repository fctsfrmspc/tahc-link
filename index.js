const { Client, MessageAttachment } = require('discord.js')
const bot = new Client()
const fs = require('fs')
const request = require('request')
const cheerio = require('cheerio')
require('dotenv').config()
const words = require('./words.json')
const wichtel = require('./wichtel.json')

let evil, tahc
let logi = 0
const scaruffi = new RegExp('beatles', 'i')
const beatles = new RegExp('scaruffi', 'i')
const me = new RegExp('(^| )link([-,!.? ]|$)','i')
let lastSoso = -1
let stopped = false

let sosotimeout = setInterval(() => {
	getSoSo()
}, process.env.SOSOMINUTES * 60000);

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
			for(let i=0; i < obj.length; i++) {
				if(typeof obj[i] == "object") {
					result = findKeyinJSON(obj[i],key)
				}
				if (result) {
					break
				}
			}
		} else if (obj.hasOwnProperty(key)) {
			return obj[key]
		} else {
			for(let i=0; i < Object.keys(obj).length; i++) {
				if(typeof obj[Object.keys(obj)[i]] == "object") {
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
					if (number > lastSoso && lastSoso != -1) {
						valuesToPost[index] = {"number":number,"title":title}
					}
					if (isFirstElement) tempSoso = number
					isFirstElement = false
				})
				lastSoso = tempSoso
				if (valuesToPost.length > 0) {
					valuesToPost.reverse()
					for (let obj of valuesToPost) {
						let strToPost = `Soso hat den Titel **${obj["title"]}** seiner Sammlung hinzugefügt. Dies ist der **${obj["number"]}**. Eintrag in seiner Liste. \:thumbsup:`
						tahc.send(strToPost)
						log("getSoso", obj["number"])
					}
				} else {
					log("getSoso", `No new titles found [Last no.: ${lastSoso}]`)
				}
				let newObj = { soso: lastSoso }
				let data = JSON.stringify(newObj)
				fs.writeFile("/tmp/lastValues.json", data, { flag: "w" }, (err) => {
					if(err) log("getSoso", err)
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

bot.on("ready", () => {
	fs.readFile("/tmp/lastValues.json", (err,data) => {
		if (err) { console.log(`fs.readFile: ${err} (Starting fresh)`) }
		else {
			let lastvals = JSON.parse(data)
			lastSoso = lastvals.soso
		}
	})
	bot.users.fetch(process.env.EVIL).then(user => { evil = user; evil.send("hi") })
	bot.channels.fetch(process.env.TAHCID).then(channel => { tahc = channel })
})

bot.login(process.env.TOKEN)

bot.on("message", async message => {
	if(message.author.bot) return;
	if(message.content.startsWith('!')) {
		if(message.content.startsWith('!sag')) {
			const saymessage = message.content.substring(4)
			return tahc.send(saymessage)
		}
		else if(message.content.startsWith('!roll')) {
			const rollmessage = message.content.substring(5)
			const args = rollmessage.split(",")
			let num1, num2, rollit
			if(args.length == 2 && !isNaN(parseInt(args[0])) && !isNaN(parseInt(args[1]))) { 
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
		else if(message.content.startsWith('!bild')) {
			let splitmsg = message.content.split(" ")
			if (splitmsg.length > 1) {
				let query = splitmsg[1]
				if (query.length > 2) {
					if (!stopped) {
						search_pics(message,query)
						stopped = true
						setTimeout(() => { stopped = false },3000)
					} else {
						message.channel.send("nicht so schnell")
					}
				} else {
					message.channel.send("suchbegriff zu kurz (min. 3 zeichen)")
				}
			}
		}
		else if (message.content.startsWith('!wichteln')) {
			const ids = wichtel["ids"]
			const organisator_id = wichtel["organisator"]
			const organisator = ids[organisator_id]
			if(message.channel.type == "dm") {
				fs.readFile("wichtel_f.json", (err, data) => {
					if(err) {
						if(err.code == "ENOENT")
							message.reply(`Es liegt aktuell keine Zuordnung von Usern und Figuren vor. (ENOENT)`)
						log("wichteln", err)
					}
					else {
						let figuren = JSON.parse(data)
						let userid = message.author.id
						if(!ids.hasOwnProperty(userid))
							return message.reply(`Unbekannter User. Nimmst du am Wichteln teil? Dann wende dich an ${organisator}.`)
						let this_user = ids[userid]
						if(!Object.keys(figuren).includes(this_user))
							return message.reply(`Du bist keiner Figur zugeordnet. Nimmst du am Wichteln teil? Dann wende dich an ${organisator}.`)
						let this_figur = figuren[this_user]
						message.reply(`du bist ${this_figur}.`)
					}
				})
			} else {
				if(message.author.id == organisator_id) {
					const usage_hint = "Befehl: `!wichteln player1, player2, ..., figur1, figur2, ...`"
					const wichtelMessage = message.content.substring(10)
					const args = wichtelMessage.split(",").map(str => str.trim())
					if(args.length < 4) {
						message.channel.send(`Es müssen mindestens zwei Leute teilnehmen! ${usage_hint}`)
						return
					}
					if(args.length % 2 != 0) {
						message.channel.send(`Die Anzahl der Spieler und Figuren muss gleich groß sein! ${usage_hint}`)
						return
					}
					const old_wichtel = wichtel["old"]
					const player_count = args.length/2
					const players = args.slice(0, player_count)
					const figures = shuffle(args.slice(player_count))
					let players_figures = {}
					for(let i = 0; i < player_count; i++) {
						players_figures[players[i]] = figures[i]
					}
					let all_constells = []
					for(let player of players) {
						for(let other_player of players) {
							if(player != other_player) {
								if(old_wichtel.hasOwnProperty(player)) {
									if(!old_wichtel[player].includes(other_player)) {
										all_constells.push([player, other_player])
									}
								} else {
									message.channel.send(`User "${player}" nicht gefunden! Verfügbare User: ${Object.keys(old_wichtel).join(", ")}`)
									return
								}
							}
						}
					}
					const MAX_ITER = 999
					let i = 1
					let successful = false
					let final_constells
					while(!successful) {
						final_constells = []
						backup_players = [[...players], [...players]]
						all_constells = shuffle(all_constells)
						for(let constell of all_constells) {
							if(backup_players[0].includes(constell[0]) && backup_players[1].includes(constell[1])) {
								final_constells.push(constell)
								backup_players[0].splice(backup_players[0].indexOf(constell[0]), 1)
								backup_players[1].splice(backup_players[1].indexOf(constell[1]), 1)
							}
							if(final_constells.length == player_count) {
								successful = true
								log("wichteln", `wichtel: Found ${player_count} unique constellations after ${i} attempts`)
								break
							}
						}
						if(i > MAX_ITER) {
							log("wichteln", `Could not find unique constellations after ${i} attempts`)
							return
						}
						i++
					}
					let stream_output = ""
					let json_output = {}
					for(let i = 0; i < player_count; i++) {
						stream_output += players_figures[final_constells[i][0]] + ": " + final_constells[i][1] + "\n"
						json_output[players[i]] = players_figures[players[i]]
					}
					const jsondata = JSON.stringify(json_output)
					fs.writeFile('wichtel_f.json', jsondata, (err) => {
						if (err) {
							throw err
						}
						log("wichteln", `Successfully wrote to "wichtel_f.json"`)
					})
					message.author.send(stream_output)
					message.channel.send("done")
				} else {
					message.reply("um herauszufinden, welche Figur dir zugeordnet wurde, schreib mich privat mit dem Befehl `!wichteln` an.")
				}
			}
		}
		else {
			message.channel.send(
				"Verfügbare Kommandos:\n" +
				"`!roll` - Zufällige Zahl zwischen 1 und 6\n" +
				"`!roll int x, int y` - Zufällige Zahl zwischen x und y\n" +
				"`!roll str a, str b, str c...` - Zufälliger String\n" +
				"`!bild suchbegriff` - Sucht nach einem Bild in /chat/.\n" +
				"`!sag [...]` - Sag mir, was ich sagen soll.\n" +
				"`!wichteln` (nur DM) - Welche Figur wurde mir zugeordnet?"
			)
		}
	} else {
		if(scaruffi.test(message.content)) {
			let scaruffiwords = words.beatles
			for(let paragraph of scaruffiwords) {
				await message.channel.send(paragraph)
			}
		}
		if(me.test(message.content)) {
			let linkquotes = words.link
			let aany = rando(linkquotes.length,0)
			await setTimeout(() => { message.channel.send(linkquotes[aany]) },2000)
		}
		if(beatles.test(message.content)) {
			const piedo = new MessageAttachment("https://i.imgur.com/RLbYJlv.png")
			await message.channel.send(words.scaruffi) 
			await message.channel.send(piedo)
		}
		if(message.content === "schön für dich") {
			message.channel.send(words.zocker)
		}
	}
});
