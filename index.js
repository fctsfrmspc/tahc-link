const { Client, MessageAttachment } = require('discord.js')
const bot = new Client()
const fs = require('fs')
const request = require('request')
const cheerio = require('cheerio')
require('dotenv').config()
const words = require('./words.json')

var evil, tahc
var scaruffi = new RegExp('beatles', 'i')
var beatles = new RegExp('scaruffi', 'i')
var me = new RegExp('(^| )link([-,!.? ]|$)','i')
var lastSoso = -1
var stopped = false

bot.on("ready", () => {
	fs.readFile("/tmp/lastValues.json", (err,data) => {
		if (err) { console.log("fs.readFile: "+err) }
		else {
			let lastvals = JSON.parse(data)
			lastSoso = lastvals.soso
		}
	})
	bot.users.fetch(process.env.EVIL).then(user => { evil = user; evil.send("hi") })
	bot.channels.fetch(process.env.TAHCID).then(channel => { tahc = channel })
})

bot.login(process.env.TOKEN)

function rando(max,min) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function htmlDecode(value) {
	return $("<div/>").html(value).text();
}

function findKeyinJSON(obj,key) {
	var result = null
	if (obj != null) {
		if (Array.isArray(obj)) {
			for(var i=0; i < obj.length; i++) {
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
			for(var i=0; i < Object.keys(obj).length; i++) {
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
			message.channel.send(process.env.IMGBASE + " nicht erreichbar")
			return console.log(err)
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
				message.channel.send(process.env.IMGBASE + " gab keine Liste zurück")
				return console.log(data)
			}
		}
	})
}

function getSoSo() {
	request.get("https://oc.mymovies.dk/em2thejay/addeddate:desc", async (err,res,body) => {
		if (err) { return console.log("getSoSo(): "+err) }
		if (res.statusCode == 200) {
			let rawHtml = body
			$ = cheerio.load(rawHtml)
			let titleList = $("li.titleCaption")
			if (titleList.length > 0) {
				let valuesToPost = []
				let isFirstElement = true
				var tempSoso
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
						let strToPost = 'Soso hat den Titel **' + obj["title"] + '** seiner Sammlung hinzugefügt. Dies ist der **' + obj["number"] + '**. Eintrag in seiner Liste. \:thumbsup:'
						tahc.send(strToPost)
						console.log("New post found: "+obj["number"])
					}
				} else {
					console.log("Soso: No new titles found [Last no.: "+lastSoso+"]")
				}
				let newObj = { soso: lastSoso }
				let data = JSON.stringify(newObj)
				fs.writeFile("/tmp/lastValues.json", data, { flag: "w" }, (err) => {
					if(err) { console.log("fs.writeFile: "+err) }
				})
			} else {
				console.log("Soso: No titles found")
				return false
			}
		} else {
			console.log("Soso: "+ res.statusCode + ": " + res.statusMessage)
			return false
		}
	})
}

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
		else {
			message.channel.send(
				"Verfügbare Kommandos:\n`!roll` - Zufällige Zahl zwischen 1 und 6\n`!roll int x, int y` - Zufällige Zahl zwischen x und y\n`!roll str a, str b, str c...` - Zufälliger String\n`!bild suchbegriff` - Sucht nach einem Bild in /chat/"
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

var sosotimeout = setInterval(() => {
	getSoSo()
}, 1200000);
