const { Client, Attachment } = require('discord.js');
const bot = new Client();
const request = require('request');
const cheerio = require('cheerio');
//const Canvas = require('canvas');
const app = express();

var evil, tahc
var scaruffi = new RegExp('beatles', 'i');
var beatles = new RegExp('scaruffi', 'i');
var me = new RegExp('(^| )link([-,!.? ]|$)','i');
var lastInstaTimestamp = -1
var lastSoso = -1
var linkquotes = ['Na','yup','Hatte ich auch schon vor','lol','würde ich nicht so sagen','haha','puh','höre ich zum ersten mal','hab den witz nicht verstanden','stimmt','könnte man so sagen','leider','nein du opfer','metroid werde ich erst später spielen','ich kenn mich bei lastfm überhaupt nicht aus','fuck sony','geldgeile arschlöcher','nope','gintama','jo','ok','ich geb bei steamcommunity den gleichen Benutzernamen und Passwort ein, und es geht nicht?','sry hatte was zu tun','gut (y)','wat','$$$','heh',':(','würde ich nicht zustimmen','ja fand ich auch nervig','gratz','nö','verstehe','so ein scheiß','ich finds nicht','was für ein unterschied macht das?','y cant metroid crawl','das ist nicht lustig','was ist','god ist tot','that sucks','dead tsundere','oy vey',';^)','lesbische bären','wie meinst du das?','eigentlich nicht','wahrscheinlich','das ist sehr nett von dir','stockente','wieso sagst du das?','lel','das stimmt','yo','zeig mal','lelmech?','kenne ich nicht','https://www.youtube.com/watch?v=qW-1WEr3o7M','Das kriege irgindwie schon hin','ja','5','was war da?','ein bisschen','6/10 würde ich sagen','cv 3 ist mein fav','ich weiß','hab ich mir schon gedacht','ich würde eigentlich sagen über 100','du meinst wahrscheinlich persona','war ja klar','ich auch','he','hm jetzt wo du fragst','irgendwann','es geht nicht','auf jeden fall','ich?','hi link','gibt es nicht ausnahmen?'];

bot.on("ready", () => {
	console.log("hi")
	tahc = bot.channels.get(process.env.TAHCID)
	evil = bot.users.get(process.env.EVIL)
	getSoSo()
})

bot.login(process.env.TOKEN);

function rando(max,min) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function htmlDecode(value) {
	return $("<div/>").html(value).text();
}

function timeConvert(stamp) {
	let zero = (number) => {
		return (number < 10) ? "0" : ""
	}
	let months = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]
	let instaStamp = new Date(stamp*1000)
	let obj = new Date(instaStamp+(7200000)) // GMT+2 DST
	let today = new Date()
	let hrs = obj.getHours()
	let min = obj.getMinutes()
	let sec = obj.getSeconds()
	let year = obj.getFullYear()
	let month = obj.getMonth()
	let realmonth = months[month]
	let date = obj.getDate()
	let time = hrs + ":" + zero(min) + min
	if (today.getMonth() == instaStamp.getMonth()) {
		if (today.getDate() == instaStamp.getDate()) {
			return ["Heute",time]
		}
		if (today.getDate() == instaStamp.getDate()-1) {
			return ["Gestern",time]
		}
	}
	return [date + ". " + realmonth + " " + year,time]
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

//function get_instagram() {
	//// GETs raw HTML, looks for window._sharedData which points to the JSON data I want
	//// definitely subject to change
	//request.get("https://www.instagram.com/selphiusmelody/", async (err,res,body) => {
		//if (err) { return console.log(err)}
		//if (res.statusCode == 200) {
			//let rawHtml = body
			//let findMe = "window._sharedData = "
			//let JSONstart = body.indexOf(findMe)
			//if (JSONstart != -1) {
				//let splitHtml = rawHtml.substring(JSONstart+findMe.length)
				//let rawJSON = splitHtml.substring(0,splitHtml.indexOf(";</script>"))
				//let json = JSON.parse(rawJSON)
				//let entry_data = json['entry_data']
				//if (entry_data.hasOwnProperty("ProfilePage")) {
					//let edges = findKeyinJSON(json,"edge_owner_to_timeline_media")
					//if (edges != null)  {
						//let posts = edges["edges"]
						//let newPoststoPost = []
						//let isFirstElement = true
						//for (var post of posts) {
							//let content = post["node"]
							//let thisTimestamp = content["taken_at_timestamp"]
							//if (thisTimestamp > lastInstaTimestamp && lastInstaTimestamp != -1) {
								//newPoststoPost.push(post)
							//}
							//if (isFirstElement) var tempTimestamp = thisTimestamp
							//isFirstElement = false
						//}
						//lastInstaTimestamp = tempTimestamp
						//if (newPoststoPost.length > 0) {
							//let stringtoPost = ""
							//for (var newPost of newPoststoPost) {
								//let newContent = newPost["node"]
								//var type = newContent["__typename"]
								//var thumb_src = newContent["thumbnail_src"]
								//const canvas = Canvas.createCanvas(640,640);
	              //const ctx = canvas.getContext('2d');
                //const background = await Canvas.loadImage(thumb_src);
	              //ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
								//var shortcode = newContent["shortcode"]
								//var thisTime = timeConvert(newContent["taken_at_timestamp"])
								//stringtoPost = "Neuer Instagram-Post von Mina (" + thisTime[0] + ", " + thisTime[1] + "): <https://www.instagram.com/p/" + shortcode + "/>"
								//if(type == "GraphSidecar") {
									//if(newContent.hasOwnProperty("edge_sidecar_to_children")) {
										//let typeObj = {"GraphVideo":0,"GraphImage":0}
										//let newedge = newContent["edge_sidecar_to_children"]
										//for(var edg of newedge["edges"]) {
											//let anotherNode = edg["node"]
											//var thistype = anotherNode["__typename"]
											//if(typeObj.hasOwnProperty(thistype)) {
												//typeObj[thistype]++
											//}
										//}
										//let s = (num) => { return (num == 1) ? "" : "s" }
										//var attachThis = " (" + typeObj["GraphImage"] + " Foto" + s(typeObj["GraphImage"]) + ", " + typeObj["GraphVideo"] + " Video" + s(typeObj["GraphVideo"]) + ")"
										//stringtoPost += attachThis
									//} else {
										//console.log("Mina: Sidecar found, but no nodes")
									//}
								//} else {
									//let typeString = (type == "GraphVideo") ? "(Video)" : "(Foto)"
									//stringtoPost += " " + typeString
								//}
								//const image = new Attachment(canvas.toBuffer())
								//tahc.send(stringtoPost)
								//tahc.send(image)
							//}
						//} else {
							//return console.log("Mina: No new posts found [Last timestamp: "+lastInstaTimestamp +"]")
						//}
					//} else {
						//return console.log("Mina: No posts found in JSON")
					//}
				//} else {
					//return console.log("Mina: Captcha requested")
				//}
			//} else {
				//return console.log("Mina: No JSON data found in HTML")
			//}
		//} else {
			//return console.log("Mina: " + res.statusCode + ": " + res.statusMessage)
		//}
	//})
}

function getSoSo() {
	request.get("https://oc.mymovies.dk/em2thejay/addeddate:desc", async (err,res,body) => {
		if (err) { return console.log(err)}
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
						//let manu = bot.emojis.get("278976825135202304")
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
		const rollmessage = message.content.substring(5);
		const args = rollmessage.split(",");
		let num1, num2, rollit;
		if(args.length == 2 && !isNaN(parseInt(args[0])) && !isNaN(parseInt(args[1]))) { 
			num1 = parseInt(args[0]);
			num2 = parseInt(args[1]);
			rollit = rando(num2,num1);
		} else if (args.length > 1) {
			num1 = rando(args.length-1,0);
			rollit = args[num1].trim();
		} else {
			rollit = rando(6,1);
		}
		return message.reply(rollit);
	}
	if(scaruffi.test(message.content)) {
		await message.channel.send("The fact that so many books still name the Beatles the greatest or most significant or most influential rock band ever only tells you how far rock music still is from becoming a serious art. Jazz critics have long recognized that the greatest jazz musicians of all times are Duke Ellington and John Coltrane, who were not the most famous or richest or best sellers of their times, let alone of all times. Classical critics rank the highly controversial Beethoven over classical musicians who were highly popular in courts around Europe. Rock critics are still blinded by commercial success: the Beatles sold more than anyone else (not true, by the way), therefore they must have been the greatest. Jazz critics grow up listening to a lot of jazz music of the past, classical critics grow up listening to a lot of classical music of the past. Rock critics are often totally ignorant of the rock music of the past, they barely know the best sellers. No wonder they will think that the Beatles did anything worth of being saved. In a sense the Beatles are emblematic of the status of rock criticism as a whole: too much attention to commercial phenomena (be it grunge or U2) and too little attention to the merits of real musicians. If somebody composes the most divine music but no major label picks him up and sells him around the world, a lot of rock critics will ignore him. If a major label picks up a musician who is as stereotyped as one can be but launches her or him worldwide, your average critic will waste rivers of ink on her or him. This is the sad status of rock criticism: rock critics are basically publicists working for free for major labels, distributors and record stores. They simply publicize what the music business wants to make money with.");
		await message.channel.send("Hopefully, one not-too-distant day, there will be a clear demarcation between a great musician like Tim Buckley, who never sold much, and commercial products like the Beatles. At such a time, rock critics will study their rock history and understand which artists accomplished which musical feat, and which simply exploited it commercially. Beatles' \"Aryan\" music removed any trace of black music from rock and roll. It replaced syncopated African rhythm with linear Western melody, and lusty negro attitudes with cute white-kid smiles. Contemporary musicians never spoke highly of the Beatles, and for good reason. They could never figure out why the Beatles' songs should be regarded more highly than their own. They knew that the Beatles were simply lucky to become a folk phenomenon (thanks to \"Beatlemania\", which had nothing to do with their musical merits). That phenomenon kept alive interest in their (mediocre) musical endeavours to this day. Nothing else grants the Beatles more attention than, say, the Kinks or the Rolling Stones. There was nothing intrinsically better in the Beatles' music. Ray Davies of the Kinks was certainly a far better songwriter than Lennon & McCartney. The Stones were certainly much more skilled musicians than the 'Fab Four'. And Pete Townshend was a far more accomplished composer, capable of entire operas such as \"Tommy\" and \"Quadrophenia\"; not to mention the far greater British musicians who followed them in subsequent decades or the US musicians themselves who initially spearheaded what the Beatles merely later repackaged to the masses.");
		await message.channel.send("The Beatles sold a lot of records not because they were the greatest musicians but simply because their music was easy to sell to the masses: it had no difficult content, it had no technical innovations, it had no creative depth. They wrote a bunch of catchy 3-minute ditties and they were photogenic. If somebody had not invented \"Beatlemania\" in 1963, you would not have wasted five minutes of your time reading these pages about such a trivial band.");
	}
	if(me.test(message.content)) {
		var aany = rando(linkquotes.length,0)
		await setTimeout(() => { message.channel.send(linkquotes[aany]); },2000)
	}
	if(beatles.test(message.content)) {
		const piedo = new Attachment("https://i.imgur.com/RLbYJlv.png");
		await message.channel.send("Why are there age limits? why is it illegal to marry a 12-year old? Helen of Troy was 12. Juliet and Cleopatra were still teenagers when they became famous. Most heroines of classic novels and poems were underage by today's laws. Thomas Edison married a 16-year-old. Medical studies show that the best age for a woman to have children is between 15 and 25 (lowest chances of miscarriage, of birth defects and, last but not least, of the woman dying while giving birth); while the worst age is after the mid 30s. And the younger you are, the more likely you are to cement a real friendship with your children; the older you are, the more likely that the \"generational gap\" will hurt your children's psychology. Therefore it is much more natural to have a child at 16 than at 40. In countless countries of the world women have their first child at a very young age, and stop having children at a relatively young age. Nonetheless, in the USA it is illegal to have sex before 18 (but, note, only if the partner is over 18, which is like saying that it is ok to rob a bank if you are a banker), while it is perfectly legal to get pregnant at 40 or (thanks to medical progress) even at 70."); 
		await message.channel.send(piedo)
	}
	if (message.content === "schön für dich") {
		message.channel.send("Du eingebildeter hurensohn ich muss das mal sagen du denkst auch the game freut sich einen wie dich zu sehen ein fan der 24 stunden am rechner sitzt im forum irgendeine scheiße über fitness erzählt obwohl er noch nie fitness gemacht hat du und dein the game könnt euch kreuzweise scheiß drauf bannt mich das ist ein forum voller nerds die über pokemon was eigendlich für kinder bestimmt ist reden und über anderen nutzlosen scheiß wie DRAGON BALL Z wer guckt so eine kinder kacke ihr seit 20 werdet erwachsen");
	}
});

var sosotimeout = setInterval(() => {
	//get_instagram()
	getSoSo()
}, 1200000);
