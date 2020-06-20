const { Client, MessageAttachment } = require('discord.js');
const bot = new Client();
const request = require('request');
const cheerio = require('cheerio');
require('dotenv').config()
const words = require('./words.json')

var evil, tahc
var scaruffi = new RegExp('beatles', 'i');
var beatles = new RegExp('scaruffi', 'i');
var me = new RegExp('(^| )link([-,!.? ]|$)','i');
var lastSoso = -1

bot.on("ready", () => {
	console.log("hi")
	tahc = bot.channels.fetch(process.env.TAHCID)
	evil = bot.users.fetch(process.env.EVIL)
	getSoSo()
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

function getSoSo() {
	request.get("https://oc.mymovies.dk/em2thejay/addeddate:desc", async (err,res,body) => {
		if (err) { return console.log(err) }
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
					for (let obj of valuesToPost) {
						let strToPost = 'Soso hat den Titel **' + obj["title"] + '** seiner Sammlung hinzugefügt. Dies ist der **' + obj["number"] + '**. Eintrag in seiner Liste. \:thumbsup:'
						tahc.send(strToPost)
					}
				} else {
					return console.log("Soso: No new titles found [Last no.: "+lastSoso+"]")
				}
			} else {
				return console.log("Soso: No titles found")
			}
		} else {
			return console.log("Soso: "+ res.statusCode + ": " + res.statusMessage)
		}
	})
}

bot.on("message", async message => {
	if(message.author.bot) return;
	if(message.content.startsWith('!roll')) {
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
});

var sosotimeout = setInterval(() => {
	getSoSo()
}, 1200000);
